import { NextRequest, NextResponse } from 'next/server';
import { deleteFileFromS3 } from '@/lib/s3';
import Database from '@/lib/database';
import { mapFileToResponse } from '@/lib/entityMappers';
import { AUTH_HEADERS } from '@/lib/constants';

// GET - List files with optional search and directory filter
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get(AUTH_HEADERS.USER_ID);
    
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const directoryPath = searchParams.get('directoryPath') || '/';
    const search = searchParams.get('search');
    const fileType = searchParams.get('fileType');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
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

    const files = await Database.findFiles(parseInt(userId), {
      directoryPath,
      ...(search && { search }),
      ...(fileType && fileType !== 'all' && { fileType }),
    });

    return NextResponse.json({
      success: true,
      files: files.map(mapFileToResponse),
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}

// PATCH - Move a file to a different directory
export async function PATCH(request: NextRequest) {
  try {
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get(AUTH_HEADERS.USER_ID);
    
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fileId, userId, newDirectoryPath } = body;

    if (!fileId || !userId || newDirectoryPath === undefined) {
      return NextResponse.json(
        { error: 'fileId, userId, and newDirectoryPath are required' },
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

    // Verify file exists and belongs to user
    const file = await Database.findFileById(parseInt(fileId), parseInt(userId));

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Update file's directory path
    await Database.updateFile(parseInt(fileId), parseInt(userId), {
      directoryPath: newDirectoryPath,
    });

    return NextResponse.json({
      success: true,
      message: 'File moved successfully',
    });
  } catch (error) {
    console.error('Error moving file:', error);
    return NextResponse.json(
      { error: 'Failed to move file' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a file
export async function DELETE(request: NextRequest) {
  try {
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get(AUTH_HEADERS.USER_ID);
    
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId');

    if (!fileId || !userId) {
      return NextResponse.json(
        { error: 'fileId and userId are required' },
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

    // Get file info
    const file = await Database.findFileById(parseInt(fileId), parseInt(userId));

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Delete file from S3
    try {
      await deleteFileFromS3({ key: file.filePath });
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      // Continue even if file doesn't exist in S3
    }

    // Delete from database
    await Database.deleteFile(parseInt(fileId), parseInt(userId));

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
