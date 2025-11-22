import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import Database from '@/lib/database';

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
    const existingUser = await Database.findUserByEmail(email);

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await Database.createUser({
      email,
      password: hashedPassword,
      name,
      role: userRole,
      teamId: team_id || undefined,
      address: address || undefined,
    });

    return NextResponse.json({
      user: {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        team_id: user.teamId,
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
