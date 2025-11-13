import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - List directories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const parentPath = searchParams.get('parentPath') || '/';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'SELECT * FROM directories WHERE user_id = $1 AND parent_path = $2 ORDER BY name ASC',
      [userId, parentPath]
    );

    return NextResponse.json({
      success: true,
      directories: result.rows,
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
    const body = await request.json();
    const { userId, name, parentPath = '/' } = body;

    if (!userId || !name) {
      return NextResponse.json(
        { error: 'userId and name are required' },
        { status: 400 }
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

    // Check if directory already exists
    const existingDir = await pool.query(
      'SELECT * FROM directories WHERE user_id = $1 AND path = $2',
      [userId, path]
    );

    if (existingDir.rows.length > 0) {
      return NextResponse.json(
        { error: 'Directory already exists' },
        { status: 400 }
      );
    }

    // Create directory
    const result = await pool.query(
      `INSERT INTO directories (user_id, name, path, parent_path)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, name, path, parentPath]
    );

    return NextResponse.json({
      success: true,
      directory: result.rows[0],
    });
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
    const { searchParams } = new URL(request.url);
    const directoryId = searchParams.get('directoryId');
    const userId = searchParams.get('userId');

    if (!directoryId || !userId) {
      return NextResponse.json(
        { error: 'directoryId and userId are required' },
        { status: 400 }
      );
    }

    // Get directory info
    const dirResult = await pool.query(
      'SELECT * FROM directories WHERE id = $1 AND user_id = $2',
      [directoryId, userId]
    );

    if (dirResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Directory not found' },
        { status: 404 }
      );
    }

    const directory = dirResult.rows[0];

    // Check if directory has files
    const filesResult = await pool.query(
      'SELECT COUNT(*) FROM files WHERE user_id = $1 AND directory_path = $2',
      [userId, directory.path]
    );

    if (parseInt(filesResult.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Directory is not empty. Please delete all files first.' },
        { status: 400 }
      );
    }

    // Check if directory has subdirectories
    const subdirsResult = await pool.query(
      'SELECT COUNT(*) FROM directories WHERE user_id = $1 AND parent_path = $2',
      [userId, directory.path]
    );

    if (parseInt(subdirsResult.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Directory has subdirectories. Please delete them first.' },
        { status: 400 }
      );
    }

    // Delete directory
    await pool.query('DELETE FROM directories WHERE id = $1', [directoryId]);

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
