import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/lookup?neonAuthUserId=...
 *
 * Called right after Neon Auth login succeeds. 404 means no Member row yet
 * — the Member App should send the user to Onboarding (see PRD Bab 4.1 flow
 * in docs/reference/LOYALTY-MEMBER-APP.md).
 */
export async function GET(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const neonAuthUserId = request.nextUrl.searchParams.get('neonAuthUserId');
  if (!neonAuthUserId) {
    return NextResponse.json({ error: 'neonAuthUserId is required' }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { neonAuthUserId } });
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  return NextResponse.json(member);
}
