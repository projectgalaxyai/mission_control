import type { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * Auth0 middleware: protects dashboard routes and handles /auth/login, /auth/callback, /auth/logout.
 * Unauthenticated users visiting / are redirected to /auth/login.
 */
export async function middleware(request: NextRequest) {
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    // Exclude static assets and /auth/profile (handled by app/auth/profile/route.ts in Node for reliable session)
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|auth/profile).*)',
  ],
};
