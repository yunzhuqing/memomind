import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/database';
import { Conversation } from '@/lib/entities/Conversation';
import { File } from '@/lib/entities/File';
import { Directory } from '@/lib/entities/Directory';
import { AUTH_HEADERS } from '@/lib/constants';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';

// POST /api/conversations/[id]/upload-image - Upload image for a conversation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = req.headers.get(AUTH_HEADERS.USER_ID);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const conversationId = parseInt(id);

    const dataSource = await getDataSource();
    const conversationRepo = dataSource.getRepository(Conversation);
    const fileRepo = dataSource.getRepository(File);
    const directoryRepo = dataSource.getRepository(Directory);

    const conversation = await conversationRepo.findOne({
      where: { id: conversationId, userId: parseInt(userId) },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const uploadedFile = formData.get('file');
    
    if (!uploadedFile || !(uploadedFile instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get file extension
    const fileName = (uploadedFile as any).name || 'image.png';
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}${fileExtension}`;
    
    // S3 key for the image
    const s3Key = `users/${userId}/conversations/${conversationId}/${uniqueFileName}`;
    
    // Convert file to buffer
    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    
    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: uploadedFile.type,
    }));

    // Ensure conversation directory exists
    const conversationPath = `/conversations/${conversationId}`;
    const existingDir = await directoryRepo.findOne({
      where: { userId: parseInt(userId), path: conversationPath },
    });

    if (!existingDir) {
      // Ensure parent conversations directory exists
      const conversationsPath = '/conversations';
      const parentDir = await directoryRepo.findOne({
        where: { userId: parseInt(userId), path: conversationsPath },
      });

      if (!parentDir) {
        const directory = directoryRepo.create({
          userId: parseInt(userId),
          name: 'conversations',
          path: conversationsPath,
          parentPath: '/',
        });
        await directoryRepo.save(directory);
      }

      // Create conversation directory
      const directory = directoryRepo.create({
        userId: parseInt(userId),
        name: conversationId.toString(),
        path: conversationPath,
        parentPath: conversationsPath,
      });
      await directoryRepo.save(directory);
    }

    // Create file record
    const fileRecord = fileRepo.create({
      userId: parseInt(userId),
      filename: uniqueFileName,
      originalFilename: fileName,
      filePath: s3Key,
      fileType: uploadedFile.type.startsWith('image/') ? 'image' : uploadedFile.type.startsWith('video/') ? 'video' : 'other',
      fileSize: uploadedFile.size,
      mimeType: uploadedFile.type,
      directoryPath: conversationPath,
    });
    await fileRepo.save(fileRecord);

    // Generate presigned URL for the uploaded image
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    
    // Generate URL that expires in 7 days
    const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 7 * 24 * 60 * 60 });
    
    return NextResponse.json({ 
      success: true, 
      s3Key,
      fileName: uniqueFileName,
      url: url // Presigned URL for accessing the image
    });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
