import { NextResponse, type NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';

export async function middleware(request: NextRequest) {
  // 1. If Auth0 is doing its own thing (login, logout, callback), step aside and let it run.
  if (request.nextUrl.pathname.startsWith('/auth/')) {
    return await auth0.middleware(request);
  }

  // 2. For all other routes, process the Auth0 middleware first.
  const response = await auth0.middleware(request);

  // 3. Check for the Auth0 session cookie directly (bulletproof for Next.js Edge runtime)
  const hasSession = request.cookies.has('appSession') || request.cookies.has('appSession.0');

  // 4. If they are trying to access the dashboard at '/' without a session, bounce them to login.
  if (request.nextUrl.pathname === '/' && !hasSession) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Exclude static assets, but let everything else (including /auth/login) run through the middleware
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
