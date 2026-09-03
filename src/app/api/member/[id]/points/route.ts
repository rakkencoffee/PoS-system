import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/:id/points
 *
 * Balance + tier snapshot (from Member's cache columns) plus the raw
 * PointLedger history that produced them.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: memberId } = await params;

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { pointBalance: true, tierLevel: true, tierPeriodSpend: true, tierPeriodStart: true },
  });
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const ledger = await prisma.pointLedger.findMany({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ ...member, ledger });
}
