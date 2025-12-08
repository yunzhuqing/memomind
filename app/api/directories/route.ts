import { NextRequest, NextResponse } from 'next/server';
import Database from '@/lib/database';
import { mapDirectoryToResponse } from '@/lib/entityMappers';

// GET - List directories
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
    const parentPath = searchParams.get('parentPath') || '/';

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

    const directories = await Database.findDirectories(parseInt(userId), parentPath);

    return NextResponse.json({
      success: true,
      directories: directories.map(mapDirectoryToResponse),
    });
  } catch (error) {
    console.error('Error fetching directories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch directories' },
      { status: 500 }
    );
  }
}

// POST - Create a new directory
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
    const { userId, name, parentPath = '/' } = body;

    if (!userId || !name) {
      return NextResponse.json(
        { error: 'userId and name are required' },
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

    // Validate directory name
    if (name.includes('/') || name.includes('\\')) {
      return NextResponse.json(
        { error: 'Directory name cannot contain slashes' },
        { status: 400 }
      );
    }

    // Create directory path
    const path = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;

    // Create directory (Database will handle unique constraint)
    try {
      const directory = await Database.createDirectory({
        userId: parseInt(userId),
        name,
        path,
        parentPath,
      });

      return NextResponse.json({
        success: true,
        directory: mapDirectoryToResponse(directory),
      });
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'Directory already exists' },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating directory:', error);
    return NextResponse.json(
      { error: 'Failed to create directory' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a directory
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
    const directoryId = searchParams.get('directoryId');
    const userId = searchParams.get('userId');

    if (!directoryId || !userId) {
      return NextResponse.json(
        { error: 'directoryId and userId are required' },
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

    // Get directory info
    const directory = await Database.findDirectoryById(parseInt(directoryId), parseInt(userId));

    if (!directory) {
      return NextResponse.json(
        { error: 'Directory not found' },
        { status: 404 }
      );
    }

    // Check if directory has files
    const files = await Database.findFiles(parseInt(userId), { directoryPath: directory.path });
    if (files.length > 0) {
      return NextResponse.json(
        { error: 'Directory is not empty. Please delete all files first.' },
        { status: 400 }
      );
    }

    // Check if directory has subdirectories
    const subdirs = await Database.findDirectories(parseInt(userId), directory.path);
    if (subdirs.length > 0) {
      return NextResponse.json(
        { error: 'Directory has subdirectories. Please delete them first.' },
        { status: 400 }
      );
    }

    // Delete directory
    await Database.deleteDirectory(parseInt(directoryId), parseInt(userId));

    return NextResponse.json({
      success: true,
      message: 'Directory deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting directory:', error);
    return NextResponse.json(
      { error: 'Failed to delete directory' },
      { status: 500 }
    );
  }
}
