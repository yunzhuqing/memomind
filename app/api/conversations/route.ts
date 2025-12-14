import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/database';
import { Conversation } from '@/lib/entities/Conversation';
import { File } from '@/lib/entities/File';
import { Directory } from '@/lib/entities/Directory';
import { AUTH_HEADERS } from '@/lib/constants';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// GET /api/conversations - Get all conversations for the current user
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get(AUTH_HEADERS.USER_ID);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dataSource = await getDataSource();
    const conversationRepo = dataSource.getRepository(Conversation);

    const conversations = await conversationRepo.find({
      where: { userId: parseInt(userId) },
      order: { updatedTime: 'DESC' },
    });

    return NextResponse.json(conversations);
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get(AUTH_HEADERS.USER_ID);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, messages } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const dataSource = await getDataSource();
    const conversationRepo = dataSource.getRepository(Conversation);
    const fileRepo = dataSource.getRepository(File);
    const directoryRepo = dataSource.getRepository(Directory);

    // Create conversation record
    const conversation = conversationRepo.create({
      name,
      userId: parseInt(userId),
    });

    await conversationRepo.save(conversation);

    // If messages are provided, save them to S3
    if (messages && messages.length > 0) {
      const s3Key = `users/${userId}/conversations/${conversation.id}/chat.json`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: JSON.stringify(messages),
        ContentType: 'application/json',
      }));

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

      // Create conversation-specific directory
      const conversationPath = `/conversations/${conversation.id}`;
      const convDirExists = await directoryRepo.findOne({
        where: { userId: parseInt(userId), path: conversationPath },
      });

      if (!convDirExists) {
        const convDirectory = directoryRepo.create({
          userId: parseInt(userId),
          name: conversation.id.toString(),
          path: conversationPath,
          parentPath: conversationsPath,
        });
        await directoryRepo.save(convDirectory);
      }

      // Create file record for the conversation
      const messagesJson = JSON.stringify(messages);
      const fileSize = Buffer.byteLength(messagesJson, 'utf8');
      
      const file = fileRepo.create({
        userId: parseInt(userId),
        filename: 'chat.json',
        originalFilename: `${name}.json`,
        filePath: s3Key,
        fileType: 'json',
        fileSize: fileSize,
        mimeType: 'application/json',
        directoryPath: conversationPath,
      });
      await fileRepo.save(file);
    }

    return NextResponse.json(conversation, { status: 201 });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/conversations - Delete a conversation
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.headers.get(AUTH_HEADERS.USER_ID);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const dataSource = await getDataSource();
    const conversationRepo = dataSource.getRepository(Conversation);
    const fileRepo = dataSource.getRepository(File);
    const directoryRepo = dataSource.getRepository(Directory);

    const conversation = await conversationRepo.findOne({
      where: { id: parseInt(id), userId: parseInt(userId) },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Delete the conversation directory from S3 (all files in it)
    const conversationPrefix = `users/${userId}/conversations/${id}/`;
    try {
      const { ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
      
      // List all objects in the conversation directory
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: conversationPrefix,
      });
      
      const listResponse = await s3Client.send(listCommand);
      
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        // Delete all objects
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: listResponse.Contents.map(obj => ({ Key: obj.Key })),
          },
        });
        
        await s3Client.send(deleteCommand);
      }
    } catch (s3Error) {
      console.error('Error deleting S3 objects:', s3Error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete the conversation directory and all its files from database
    const conversationPath = `/conversations/${id}`;
    try {
      // Delete all file records in the directory
      await fileRepo.delete({
        userId: parseInt(userId),
        directoryPath: conversationPath,
      });
      
      // Delete the directory record
      await directoryRepo.delete({
        userId: parseInt(userId),
        path: conversationPath,
      });
    } catch (dbError) {
      console.error('Error deleting directory and files from database:', dbError);
    }

    await conversationRepo.remove(conversation);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
