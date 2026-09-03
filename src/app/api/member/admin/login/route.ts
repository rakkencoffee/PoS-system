import { NextRequest, NextResponse } from 'next/server';
import { requireMemberApiKey } from '@/lib/member-api-guard';
import { verifyCredentials } from '@/lib/auth';

/**
 * POST /api/member/admin/login
 *
 * Body: { username, password }
 *
 * Validates against the same User table PoS-system's own NextAuth login
 * uses. The Member App backend calls this once, then manages its OWN admin
 * session (separately from PoS-system's) — see
 * docs/reference/LOYALTY-MEMBER-APP.md §2 for why.
 */
export async function POST(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
  }

  const user = await verifyCredentials(username, password);
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Not an admin account' }, { status: 403 });
  }

  return NextResponse.json(user);
}
