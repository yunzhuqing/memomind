import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/database';
import { Conversation } from '@/lib/entities/Conversation';
import { File } from '@/lib/entities/File';
import { AUTH_HEADERS } from '@/lib/constants';

// PATCH /api/conversations/[id] - Update conversation details
export async function PATCH(
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
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const dataSource = await getDataSource();
    const conversationRepo = dataSource.getRepository(Conversation);
    const fileRepo = dataSource.getRepository(File);

    const conversation = await conversationRepo.findOne({
      where: { id: conversationId, userId: parseInt(userId) },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Update conversation name
    conversation.name = name;
    await conversationRepo.save(conversation);

    // Update file record if it exists
    if (conversation.s3Key) {
      const file = await fileRepo.findOne({
        where: { userId: parseInt(userId), filePath: conversation.s3Key },
      });
      
      if (file) {
        file.originalFilename = `${name}.json`;
        await fileRepo.save(file);
      }
    }

    return NextResponse.json({ success: true, conversation });
  } catch (error: any) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
