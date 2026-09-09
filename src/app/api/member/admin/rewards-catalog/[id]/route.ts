import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * PUT /api/member/admin/rewards-catalog/:id
 *
 * Edits an existing reward — including toggling isActive. There is no
 * DELETE endpoint on purpose: rewards can be referenced by RedeemedReward/
 * ClaimedBenefit rows, so "remove from the catalog" means isActive=false,
 * not a hard delete.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  for (const key of [
    'name',
    'category',
    'pointCost',
    'linkedProductId',
    'stockQuota',
    'isActive',
    'isBirthdayReward',
    'discountType',
    'discountValue',
  ]) {
    if (key in body) data[key] = body[key];
  }
  if ('validFrom' in body) data.validFrom = body.validFrom ? new Date(body.validFrom) : null;
  if ('validUntil' in body) data.validUntil = body.validUntil ? new Date(body.validUntil) : null;

  try {
    const reward = await prisma.rewardsCatalog.update({ where: { id }, data });
    return NextResponse.json(reward);
  } catch {
    return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
  }
}
