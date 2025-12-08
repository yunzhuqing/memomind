import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import Database from '@/lib/database';
import { mapUserToResponse } from '@/lib/entityMappers';
import { AUTH_HEADERS } from '@/lib/constants';

// GET - List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get(AUTH_HEADERS.USER_ID);
    const authUserRole = request.headers.get(AUTH_HEADERS.USER_ROLE);

    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if requesting user is admin
    if (authUserRole !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Get all users
    const users = await Database.getAllUsers();

    return NextResponse.json({
      success: true,
      users: users.map(mapUserToResponse),
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
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get(AUTH_HEADERS.USER_ID);
    const authUserRole = request.headers.get(AUTH_HEADERS.USER_ROLE);

    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if requesting user is admin
    if (authUserRole !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, password, name, role, team_id, address } = body;

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
    const existingUser = await Database.findUserByEmail(email);

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
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
      success: true,
      user: mapUserToResponse(user),
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
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get(AUTH_HEADERS.USER_ID);
    const authUserRole = request.headers.get(AUTH_HEADERS.USER_ROLE);

    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if requesting user is admin
    if (authUserRole !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, email, name, role, team_id, address } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) {
      const validRoles = ['user', 'admin'];
      if (validRoles.includes(role)) {
        updateData.role = role;
      }
    }
    if (team_id !== undefined) updateData.teamId = team_id;
    if (address !== undefined) updateData.address = address;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update user
    const updated = await Database.updateUser(parseInt(userId), updateData);

    if (!updated) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const updatedUser = await Database.findUserById(parseInt(userId));

    return NextResponse.json({
      success: true,
      user: updatedUser ? mapUserToResponse(updatedUser) : null,
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
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get(AUTH_HEADERS.USER_ID);
    const authUserRole = request.headers.get(AUTH_HEADERS.USER_ROLE);

    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if requesting user is admin
    if (authUserRole !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Prevent admin from deleting themselves
    if (authUserId === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Delete user
    const deleted = await Database.deleteUser(parseInt(userId));

    if (!deleted) {
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
