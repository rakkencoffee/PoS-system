import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * POST /api/member/admin/members/:id/adjust-points
 *
 * Manual point correction for CS cases (PRD Bab 10.2). Body: { amount, note }
 * — amount can be negative (correction) or positive (goodwill credit).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: memberId } = await params;
  const { amount, note } = await request.json();

  if (typeof amount !== 'number' || amount === 0 || !note) {
    return NextResponse.json({ error: 'amount (non-zero) and note are required' }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const [, updatedMember] = await prisma.$transaction([
    prisma.pointLedger.create({
      data: { memberId, type: 'ADJUSTMENT', amount, note },
    }),
    prisma.member.update({
      where: { id: memberId },
      data: { pointBalance: { increment: amount } },
    }),
  ]);

  return NextResponse.json({ pointBalance: updatedMember.pointBalance });
}
