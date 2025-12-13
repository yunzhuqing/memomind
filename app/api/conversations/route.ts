import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/database';
import { Conversation } from '@/lib/entities/Conversation';
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

    // Create conversation record
    const conversation = conversationRepo.create({
      name,
      userId: parseInt(userId),
    });

    await conversationRepo.save(conversation);

    // If messages are provided, save them to S3
    if (messages && messages.length > 0) {
      const s3Key = `conversations/${userId}/${conversation.id}.json`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: JSON.stringify(messages),
        ContentType: 'application/json',
      }));

      conversation.s3Key = s3Key;
      await conversationRepo.save(conversation);
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

    const conversation = await conversationRepo.findOne({
      where: { id: parseInt(id), userId: parseInt(userId) },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Delete messages from S3 if they exist
    if (conversation.s3Key) {
      try {
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
        await s3Client.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: conversation.s3Key,
        }));
      } catch (s3Error) {
        console.error('Error deleting S3 object:', s3Error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    await conversationRepo.remove(conversation);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
