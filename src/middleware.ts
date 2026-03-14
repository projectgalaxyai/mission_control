import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * Auth0 middleware: protects dashboard routes and handles /auth/login, /auth/callback, /auth/logout.
 * Unauthenticated users visiting / are redirected to /auth/login.
 */
export async function middleware(request: NextRequest) {
  const response = await auth0.middleware(request);

  if (request.nextUrl.pathname === '/') {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Exclude static assets and /auth/profile (handled by app/auth/profile/route.ts in Node for reliable session)
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|auth/profile).*)',
  ],
};
