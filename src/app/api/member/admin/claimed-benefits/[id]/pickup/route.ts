import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * POST /api/member/admin/claimed-benefits/:id/pickup
 *
 * Staff-facing counterpart to the checkout bridge in POST
 * /api/member/orders — that route REJECTS BIRTHDAY benefits linked to a
 * MERCHANDISE catalog item (Tier 4's free merch, see
 * TierRule.birthdayFreeMerch) for the same reason RedeemedReward
 * MERCHANDISE is rejected there: it's handed over physically, never via an
 * order. Scoped to rewardsCatalog.category=MERCHANDISE so this can't be
 * used to shortcut a TIER_UPGRADE/WEEKLY_MEMBER_DAY/free-beverage benefit,
 * which must go through checkout to get its discount actually applied.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id } = await params;

  const benefit = await prisma.claimedBenefit.findUnique({
    where: { id },
    include: { rewardsCatalog: { select: { category: true } } },
  });

  if (!benefit) {
    return NextResponse.json({ error: 'Claimed benefit not found' }, { status: 404 });
  }
  if (benefit.rewardsCatalog?.category !== 'MERCHANDISE') {
    return NextResponse.json({ error: 'Only merchandise benefits are picked up this way' }, { status: 400 });
  }
  if (benefit.status !== 'AVAILABLE') {
    return NextResponse.json({ error: `Benefit is already ${benefit.status.toLowerCase()}` }, { status: 400 });
  }
  if (benefit.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Benefit has expired' }, { status: 400 });
  }

  await prisma.claimedBenefit.update({
    where: { id },
    data: { status: 'CLAIMED', claimedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
