import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/database';
import { File } from '@/lib/entities/File';
import { AUTH_HEADERS } from '@/lib/constants';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// GET /api/files/content - Get file content for editing
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get(AUTH_HEADERS.USER_ID);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const dataSource = await getDataSource();
    const fileRepo = dataSource.getRepository(File);

    const file = await fileRepo.findOne({
      where: { id: parseInt(fileId), userId: parseInt(userId) },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Only allow editing text-based files
    const editableTypes = ['json', 'text', 'markdown'];
    if (!editableTypes.includes(file.fileType)) {
      return NextResponse.json({ error: 'File type not editable' }, { status: 400 });
    }

    // Get file content from S3
    // Use filename (S3 key) instead of filePath
    const s3Key = file.filePath;
    console.log('Reading file from S3:', s3Key);
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    const content = await response.Body?.transformToString('utf-8');

    return NextResponse.json({
      success: true,
      content: content || '',
      filename: file.originalFilename,
      fileType: file.fileType,
    });
  } catch (error: any) {
    console.error('Error getting file content:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/files/content - Update file content
export async function PUT(req: NextRequest) {
  try {
    const userId = req.headers.get(AUTH_HEADERS.USER_ID);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { fileId, content } = body;

    if (!fileId || content === undefined) {
      return NextResponse.json({ error: 'File ID and content are required' }, { status: 400 });
    }

    const dataSource = await getDataSource();
    const fileRepo = dataSource.getRepository(File);

    const file = await fileRepo.findOne({
      where: { id: parseInt(fileId), userId: parseInt(userId) },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Only allow editing text-based files
    const editableTypes = ['json', 'text', 'markdown'];
    if (!editableTypes.includes(file.fileType)) {
      return NextResponse.json({ error: 'File type not editable' }, { status: 400 });
    }

    // Validate JSON if file type is json
    if (file.fileType === 'json') {
      try {
        JSON.parse(content);
      } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
      }
    }

    // Upload updated content to S3
    // Use filename (S3 key) instead of filePath
    const s3Key = file.filename;
    console.log('Writing file to S3:', s3Key);
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: content,
      ContentType: file.mimeType,
    });

    await s3Client.send(command);

    // Update file size
    const newSize = Buffer.byteLength(content, 'utf-8');
    file.fileSize = newSize;
    await fileRepo.save(file);

    return NextResponse.json({
      success: true,
      message: 'File updated successfully',
      fileSize: newSize,
    });
  } catch (error: any) {
    console.error('Error updating file content:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
