import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET all notes for a user
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    const result = await pool.query(
      'SELECT id, title, content, created_at, updated_at FROM notes WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );

    const notes = result.rows.map((note) => ({
      id: note.id.toString(),
      title: note.title,
      content: note.content,
      createdAt: note.created_at.toISOString(),
      updatedAt: note.updated_at.toISOString(),
    }));

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Get notes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST create a new note
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    const { title, content } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING id, title, content, created_at, updated_at',
      [userId, title, content || '']
    );

    const note = result.rows[0];

    return NextResponse.json({
      note: {
        id: note.id.toString(),
        title: note.title,
        content: note.content,
        createdAt: note.created_at.toISOString(),
        updatedAt: note.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create note error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT update a note
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    const { id, title, content } = await request.json();

    if (!id || !title) {
      return NextResponse.json(
        { error: 'Note ID and title are required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'UPDATE notes SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING id, title, content, created_at, updated_at',
      [title, content || '', id, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    const note = result.rows[0];

    return NextResponse.json({
      note: {
        id: note.id.toString(),
        title: note.title,
        content: note.content,
        createdAt: note.created_at.toISOString(),
        updatedAt: note.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update note error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE a note
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('id');

    if (!noteId) {
      return NextResponse.json(
        { error: 'Note ID is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
      [noteId, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete note error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
