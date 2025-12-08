import { NextRequest, NextResponse } from 'next/server';
import Database from '@/lib/database';

// GET - 获取用户的任务列表
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get('x-user-id');
    
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate user access
    if (authUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const tasks = await Database.findTasks(parseInt(userId), {
      ...(status && { status }),
      ...(type && { type }),
    });

    return NextResponse.json({
      success: true,
      tasks,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// POST - 创建新任务
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get('x-user-id');
    
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      userId,
      type,
      name,
      status = 'pending',
      totalSize = 0,
      filePath,
      metadata = {},
    } = body;

    if (!userId || !type || !name) {
      return NextResponse.json(
        { error: 'userId, type, and name are required' },
        { status: 400 }
      );
    }

    // Validate user access
    if (authUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const task = await Database.createTask({
      userId: parseInt(userId),
      type,
      name,
      status,
      totalSize,
      filePath,
      metadata,
    });

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

// PATCH - 更新任务状态和进度
export async function PATCH(request: NextRequest) {
  try {
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get('x-user-id');
    
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      taskId,
      userId,
      status,
      progress,
      downloadedSize,
      errorMessage,
    } = body;

    if (!taskId || !userId) {
      return NextResponse.json(
        { error: 'Task ID and User ID are required' },
        { status: 400 }
      );
    }

    // Validate user access
    if (authUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const updateData: any = {};
    
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completedAt = new Date();
      }
    }
    
    if (progress !== undefined) updateData.progress = progress;
    if (downloadedSize !== undefined) updateData.downloadedSize = downloadedSize;
    if (errorMessage !== undefined) updateData.errorMessage = errorMessage;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    const updated = await Database.updateTask(parseInt(taskId), parseInt(userId), updateData);

    if (!updated) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const task = await Database.findTaskById(parseInt(taskId), parseInt(userId));

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// DELETE - 删除任务
export async function DELETE(request: NextRequest) {
  try {
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get('x-user-id');
    
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const userId = searchParams.get('userId');

    if (!taskId || !userId) {
      return NextResponse.json(
        { error: 'Task ID and User ID are required' },
        { status: 400 }
      );
    }

    // Validate user access
    if (authUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const deleted = await Database.deleteTask(parseInt(taskId), parseInt(userId));

    if (!deleted) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
