import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * GET /auth/profile - Returns current session user for useUser() client hook.
 * Handled here (Node runtime) so session is read reliably; middleware skips this path.
 */
export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(session.user);
}
