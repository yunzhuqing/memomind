import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/database';
import { Conversation } from '@/lib/entities/Conversation';
import { File } from '@/lib/entities/File';
import { Directory } from '@/lib/entities/Directory';
import { AUTH_HEADERS } from '@/lib/constants';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// GET /api/conversations/[id]/messages - Get messages for a conversation from S3
export async function GET(
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

    const conversation = await conversationRepo.findOne({
      where: { id: conversationId, userId: parseInt(userId) },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // If no S3 key, return empty messages
    if (!conversation.s3Key) {
      return NextResponse.json({ messages: [] });
    }

    // Get messages from S3
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: conversation.s3Key,
    });

    const response = await s3Client.send(command);
    const body = await response.Body?.transformToString();
    const messages = body ? JSON.parse(body) : [];

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('Error fetching conversation messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/conversations/[id]/messages - Update messages for a conversation in S3
export async function PUT(
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
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

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

    // Create S3 key if it doesn't exist - now using conversation-specific directory
    const s3Key = conversation.s3Key || `users/${userId}/conversations/${conversationId}/chat.json`;
    const messagesJson = JSON.stringify(messages);

    // Save messages to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: messagesJson,
      ContentType: 'application/json',
    }));

    // Update conversation with S3 key if it was just created
    if (!conversation.s3Key) {
      conversation.s3Key = s3Key;
      await conversationRepo.save(conversation);

      // Ensure conversations directory exists
      const conversationsPath = '/conversations';
      const existingDir = await directoryRepo.findOne({
        where: { userId: parseInt(userId), path: conversationsPath },
      });

      if (!existingDir) {
        const directory = directoryRepo.create({
          userId: parseInt(userId),
          name: 'conversations',
          path: conversationsPath,
          parentPath: '/',
        });
        await directoryRepo.save(directory);
      }

      // Create conversation-specific directory to match S3 structure
      const conversationPath = `/conversations/${conversationId}`;
      const convDirExists = await directoryRepo.findOne({
        where: { userId: parseInt(userId), path: conversationPath },
      });

      if (!convDirExists) {
        const convDirectory = directoryRepo.create({
          userId: parseInt(userId),
          name: conversationId.toString(),
          path: conversationPath,
          parentPath: conversationsPath,
        });
        await directoryRepo.save(convDirectory);
      }

      // Create file record for the conversation in conversation-specific directory
      const fileSize = Buffer.byteLength(messagesJson, 'utf8');
      
      const file = fileRepo.create({
        userId: parseInt(userId),
        filename: 'chat.json',
        originalFilename: `${conversation.name}.json`,
        filePath: s3Key,
        fileType: 'json',
        fileSize: fileSize,
        mimeType: 'application/json',
        directoryPath: conversationPath,
      });
      await fileRepo.save(file);
    } else {
      // Update existing file record with new size
      const file = await fileRepo.findOne({
        where: { userId: parseInt(userId), filePath: s3Key },
      });
      
      if (file) {
        file.fileSize = Buffer.byteLength(messagesJson, 'utf8');
        await fileRepo.save(file);
      }
    }

    return NextResponse.json({ success: true, s3Key });
  } catch (error: any) {
    console.error('Error updating conversation messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
