import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

/**
 * Validates user authentication from cookies
 * Returns the authenticated user or null if not authenticated
 */
export async function validateUserAuth(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Get user data from cookie
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie || !userCookie.value) {
      return null;
    }

    // Parse user data from cookie
    const user = JSON.parse(userCookie.value) as AuthUser;
    
    // Validate user object has required fields
    if (!user.id || !user.email) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error validating user auth:', error);
    return null;
  }
}

/**
 * Validates that the authenticated user matches the requested userId
 */
export function validateUserAccess(authUser: AuthUser, requestedUserId: string): boolean {
  return authUser.id === requestedUserId;
}

/**
 * Checks if user has admin role
 */
export function isAdmin(user: AuthUser): boolean {
  return user.role === 'admin';
}
