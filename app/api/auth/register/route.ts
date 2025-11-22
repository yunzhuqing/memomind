import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role, team_id, address } = await request.json();

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    // Validate role if provided
    const validRoles = ['user', 'admin'];
    const userRole = role && validRoles.includes(role) ? role : 'user';

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user with new fields
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role, team_id, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role, team_id, address, created_at',
      [email, hashedPassword, name, userRole, team_id || null, address || null]
    );

    const user = result.rows[0];

    return NextResponse.json({
      user: {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        team_id: user.team_id,
        address: user.address,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
