import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * POST /api/member/admin/redeemed-rewards/:id/pickup
 *
 * Staff-facing counterpart to the checkout bridge in POST
 * /api/member/orders — that route REJECTS MERCHANDISE rewards (they never
 * flow through an order), so this is the only place a MERCHANDISE
 * RedeemedReward ever gets marked USED. Scoped to category=MERCHANDISE on
 * purpose: a VOUCHER/FREE_ITEM reward must go through checkout, never this
 * shortcut, so a staff member fat-fingering the wrong id can't silently
 * burn a reward that was meant to apply a discount.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id } = await params;

  const reward = await prisma.redeemedReward.findUnique({
    where: { id },
    include: { rewardsCatalog: { select: { category: true } } },
  });

  if (!reward) {
    return NextResponse.json({ error: 'Redeemed reward not found' }, { status: 404 });
  }
  if (reward.rewardsCatalog.category !== 'MERCHANDISE') {
    return NextResponse.json({ error: 'Only merchandise rewards are picked up this way' }, { status: 400 });
  }
  if (reward.status !== 'AVAILABLE') {
    return NextResponse.json({ error: `Reward is already ${reward.status.toLowerCase()}` }, { status: 400 });
  }
  if (reward.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Reward has expired' }, { status: 400 });
  }

  await prisma.redeemedReward.update({ where: { id }, data: { status: 'USED' } });

  return NextResponse.json({ success: true });
}
