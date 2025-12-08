import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_HEADERS, COOKIES } from '@/lib/constants';

// Define routes that don't require authentication
const publicRoutes = [
  '/api/auth/login',
  '/api/auth/register',
  '/login',
  '/register',
];

// Define API routes that require authentication
const protectedApiRoutes = [
  '/api/files',
  '/api/download',
  '/api/torrent',
  '/api/notes',
  '/api/tasks',
  '/api/directories',
  '/api/admin',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if it's a public route
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if it's a protected API route
  const isProtectedApi = protectedApiRoutes.some(route => pathname.startsWith(route));
  
  if (isProtectedApi) {
    // Get user cookie
    const userCookie = request.cookies.get(COOKIES.USER);
    
    if (!userCookie || !userCookie.value) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      // Validate cookie contains valid user data
      const user = JSON.parse(userCookie.value);
      
      if (!user.id || !user.email) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Add user info to request headers for easy access in API routes
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(AUTH_HEADERS.USER_ID, user.id);
      requestHeaders.set(AUTH_HEADERS.USER_EMAIL, user.email);
      requestHeaders.set(AUTH_HEADERS.USER_ROLE, user.role || 'user');

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
