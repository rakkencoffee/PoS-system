import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/admin/rewards-catalog
 *
 * Full list (active + inactive) for the admin CRUD page — covers all 3
 * categories (VOUCHER/FREE_ITEM/MERCHANDISE). /rewards (Rewards Store) and
 * /merch on the Member App only ever read the isActive=true subset of this
 * same table.
 */
export async function GET(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const rewards = await prisma.rewardsCatalog.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(rewards);
}

/**
 * POST /api/member/admin/rewards-catalog
 *
 * Body: { name, category, pointCost, linkedProductId?, stockQuota?,
 *   isBirthdayReward?, discountType?, discountValue?, validFrom?, validUntil? }
 */
export async function POST(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const body = await request.json();
  const { name, category, pointCost } = body;

  if (!name || !category || typeof pointCost !== 'number') {
    return NextResponse.json({ error: 'name, category, and pointCost are required' }, { status: 400 });
  }

  const reward = await prisma.rewardsCatalog.create({
    data: {
      name,
      category,
      pointCost,
      linkedProductId: body.linkedProductId || null,
      stockQuota: body.stockQuota ?? null,
      isBirthdayReward: body.isBirthdayReward ?? false,
      discountType: body.discountType || null,
      discountValue: body.discountValue ?? null,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    },
  });

  return NextResponse.json(reward, { status: 201 });
}
