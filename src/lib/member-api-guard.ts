import { NextRequest, NextResponse } from 'next/server';

/**
 * Guard for /api/member/* routes — these are called server-to-server by the
 * Member App's own backend (already validated its Neon Auth session), never
 * directly from a browser, so this checks a shared secret instead of CORS.
 * See docs/reference/LOYALTY-MEMBER-APP.md §2.
 */
export function requireMemberApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get('x-api-key');
  const expected = process.env.MEMBER_APP_API_KEY;
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
