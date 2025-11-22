import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import pool from '@/lib/db';

// GET - List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestingUserId = searchParams.get('requestingUserId');

    if (!requestingUserId) {
      return NextResponse.json(
        { error: 'Requesting user ID is required' },
        { status: 400 }
      );
    }

    // Check if requesting user is admin
    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [requestingUserId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Get all users
    const result = await pool.query(
      'SELECT id, email, name, role, team_id, address, created_at FROM users ORDER BY created_at DESC'
    );

    return NextResponse.json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestingUserId, email, password, name, role, team_id, address } = body;

    if (!requestingUserId) {
      return NextResponse.json(
        { error: 'Requesting user ID is required' },
        { status: 400 }
      );
    }

    // Check if requesting user is admin
    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [requestingUserId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['user', 'admin'];
    const userRole = role && validRoles.includes(role) ? role : 'user';

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role, team_id, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role, team_id, address, created_at',
      [email, hashedPassword, name, userRole, team_id || null, address || null]
    );

    const user = result.rows[0];

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        team_id: user.team_id,
        address: user.address,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// PATCH - Update user (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestingUserId, userId, email, name, role, team_id, address } = body;

    if (!requestingUserId || !userId) {
      return NextResponse.json(
        { error: 'Requesting user ID and user ID are required' },
        { status: 400 }
      );
    }

    // Check if requesting user is admin
    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [requestingUserId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (role !== undefined) {
      const validRoles = ['user', 'admin'];
      if (validRoles.includes(role)) {
        updates.push(`role = $${paramIndex++}`);
        values.push(role);
      }
    }
    if (team_id !== undefined) {
      updates.push(`team_id = $${paramIndex++}`);
      values.push(team_id);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(address);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, name, role, team_id, address, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestingUserId = searchParams.get('requestingUserId');
    const userId = searchParams.get('userId');

    if (!requestingUserId || !userId) {
      return NextResponse.json(
        { error: 'Requesting user ID and user ID are required' },
        { status: 400 }
      );
    }

    // Check if requesting user is admin
    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [requestingUserId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Prevent admin from deleting themselves
    if (requestingUserId === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Delete user
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
