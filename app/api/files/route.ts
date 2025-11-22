import { NextRequest, NextResponse } from 'next/server';
import { deleteFileFromS3 } from '@/lib/s3';
import pool from '@/lib/db';

// GET - List files with optional search and directory filter
export async function GET(request: NextRequest) {
  try {
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

    let query = 'SELECT * FROM files WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    // Filter by directory
    query += ` AND directory_path = $${paramIndex}`;
    params.push(directoryPath);
    paramIndex++;

    // Search filter
    if (search) {
      query += ` AND (original_filename ILIKE $${paramIndex} OR filename ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // File type filter
    if (fileType && fileType !== 'all') {
      query += ` AND file_type = $${paramIndex}`;
      params.push(fileType);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      files: result.rows,
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
    const body = await request.json();
    const { fileId, userId, newDirectoryPath } = body;

    if (!fileId || !userId || newDirectoryPath === undefined) {
      return NextResponse.json(
        { error: 'fileId, userId, and newDirectoryPath are required' },
        { status: 400 }
      );
    }

    // Verify file exists and belongs to user
    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, userId]
    );

    if (fileResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Update file's directory path
    await pool.query(
      'UPDATE files SET directory_path = $1 WHERE id = $2',
      [newDirectoryPath, fileId]
    );

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
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId');

    if (!fileId || !userId) {
      return NextResponse.json(
        { error: 'fileId and userId are required' },
        { status: 400 }
      );
    }

    // Get file info
    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, userId]
    );

    if (fileResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const file = fileResult.rows[0];

    // Delete file from S3
    try {
      await deleteFileFromS3({ key: file.file_path });
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      // Continue even if file doesn't exist in S3
    }

    // Delete from database
    await pool.query('DELETE FROM files WHERE id = $1', [fileId]);

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
