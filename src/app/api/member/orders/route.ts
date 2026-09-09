import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/orders?memberId=...
 *
 * Order history list for the Riwayat Pesanan page — newest first, items
 * included so the list can show a short summary without a second request.
 */
export async function GET(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const memberId = request.nextUrl.searchParams.get('memberId');
  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  return NextResponse.json(
    orders.map((order) => ({
      id: order.id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({ name: item.name, quantity: item.quantity })),
    }))
  );
}

// Categories whose items count as "minuman" for the BIRTHDAY free-beverage
// benefit — derived from real Olsera category slugs (checked via a
// throwaway script against getMenuItems()), not guessed. dessert/bites/
// main-course are food, so they're excluded.
const BEVERAGE_CATEGORY_SLUGS = new Set(['non-coffee', 'rakken-signature', 'rakken-style', 'refreshment']);

type OrderItemInput = {
  productId: string;
  variantId?: string;
  quantity: number;
  price?: number;
  note?: string;
  name?: string;
  options?: any;
};

/**
 * Reduces the price of exactly ONE unit among items matching `predicate`
 * (the cheapest or most expensive, per `pick`) — splitting its line in two
 * when quantity > 1, so a benefit never silently discounts every unit of a
 * multi-quantity line. Mutates `orderItems` in place. Returns null if no
 * item matched the predicate.
 */
function adjustOneUnitPrice(
  orderItems: OrderItemInput[],
  predicate: (item: OrderItemInput) => boolean,
  pick: 'max' | 'min',
  newPrice: (currentPrice: number) => number
): { originalPrice: number } | null {
  let targetIndex = -1;
  let targetPrice = pick === 'max' ? -Infinity : Infinity;
  orderItems.forEach((item, index) => {
    if (!predicate(item)) return;
    const price = item.price ?? 0;
    if ((pick === 'max' && price > targetPrice) || (pick === 'min' && price < targetPrice)) {
      targetPrice = price;
      targetIndex = index;
    }
  });
  if (targetIndex === -1) return null;

  const target = orderItems[targetIndex];
  const originalPrice = target.price ?? 0;
  if (target.quantity > 1) {
    orderItems[targetIndex] = { ...target, quantity: target.quantity - 1 };
    orderItems.splice(targetIndex + 1, 0, { ...target, quantity: 1, price: newPrice(originalPrice) });
  } else {
    orderItems[targetIndex] = { ...target, price: newPrice(originalPrice) };
  }
  return { originalPrice };
}

/**
 * Validates + applies one ClaimedBenefit (automated tier-upgrade/birthday/
 * weekly-member-day rewards — see ClaimedBenefit in schema.prisma) to the
 * cart. Mutates `orderItems` directly for item-scoped benefits (TIER_UPGRADE,
 * BIRTHDAY) instead of going through createOrder()'s proportional
 * discountAmount split, so the discount lands on exactly the right item(s)
 * with no risk to the shared kiosk order path. WEEKLY_MEMBER_DAY is a flat
 * % off the whole order, so it returns a discountAmount instead.
 */
async function applyClaimedBenefit(
  claimedBenefitId: string,
  memberId: string,
  orderItems: OrderItemInput[]
): Promise<{ error: NextResponse } | { discountAmount: number; benefitId: string }> {
  const benefit = await prisma.claimedBenefit.findUnique({
    where: { id: claimedBenefitId },
    include: { rewardsCatalog: true },
  });

  if (
    !benefit ||
    benefit.memberId !== memberId ||
    benefit.status !== 'AVAILABLE' ||
    benefit.expiresAt < new Date()
  ) {
    return { error: NextResponse.json({ error: 'Claimed benefit is not available' }, { status: 400 }) };
  }

  if (benefit.type === 'TIER_UPGRADE') {
    const tierRule = benefit.tierLevelReached
      ? await prisma.tierRule.findUnique({ where: { level: benefit.tierLevelReached } })
      : null;
    if (!tierRule) {
      return { error: NextResponse.json({ error: 'Tier rule for this benefit no longer exists' }, { status: 500 }) };
    }
    const result = adjustOneUnitPrice(orderItems, () => true, 'max', (price) =>
      Math.round(price * (1 - tierRule.upgradeVoucherPercent / 100))
    );
    if (!result) {
      return { error: NextResponse.json({ error: 'Cart is empty' }, { status: 400 }) };
    }
  } else if (benefit.type === 'WEEKLY_MEMBER_DAY') {
    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { tierLevel: true } });
    const tierRule = member ? await prisma.tierRule.findUnique({ where: { level: member.tierLevel } }) : null;
    if (!tierRule) {
      return { error: NextResponse.json({ error: 'Tier rule for this member no longer exists' }, { status: 500 }) };
    }
    const cartTotal = orderItems.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
    return { discountAmount: Math.round((cartTotal * tierRule.weeklyDiscountPercent) / 100), benefitId: benefit.id };
  } else if (benefit.type === 'BIRTHDAY') {
    if (benefit.rewardsCatalogId) {
      const reward = benefit.rewardsCatalog!;
      if (reward.category === 'MERCHANDISE') {
        return {
          error: NextResponse.json(
            { error: 'Merchandise rewards are claimed at the outlet, not at checkout' },
            { status: 400 }
          ),
        };
      }
      if (!reward.linkedProductId) {
        return { error: NextResponse.json({ error: 'Reward has no linked product' }, { status: 500 }) };
      }
      const posAdapter = await import('@/lib/integrations/pos.adapter');
      const menuItems = await posAdapter.getMenuItems();
      const product = menuItems.find((m) => m.id === reward.linkedProductId);
      if (!product) {
        return { error: NextResponse.json({ error: 'Linked product is no longer available' }, { status: 400 }) };
      }
      orderItems.push({ productId: product.id, quantity: 1, price: 0, name: product.name });
    } else {
      // Generic free-beverage perk — cheapest item that IS a beverage among
      // what's actually in the cart, not just the cheapest item overall.
      const posAdapter = await import('@/lib/integrations/pos.adapter');
      const menuItems = await posAdapter.getMenuItems();
      const categoryByProductId = new Map(menuItems.map((m) => [m.id, m.categorySlug]));
      const isBeverage = (item: OrderItemInput) =>
        BEVERAGE_CATEGORY_SLUGS.has(categoryByProductId.get(item.productId) ?? '');
      const result = adjustOneUnitPrice(orderItems, isBeverage, 'min', () => 0);
      if (!result) {
        return {
          error: NextResponse.json(
            { error: 'Beli minimal 1 minuman dulu untuk klaim gratis minuman ulang tahun' },
            { status: 400 }
          ),
        };
      }
    }
  }

  return { discountAmount: 0, benefitId: benefit.id };
}

/**
 * POST /api/member/orders
 *
 * Creates a pickup order for a member. Reuses pos.adapter.createOrder() —
 * the exact function the kiosk uses — so Olsera sync, queue numbers, and
 * kitchen print dispatch all behave identically to a kiosk order. The only
 * addition is tagging the resulting Order row with channel=MEMBER_APP and
 * memberId, which createOrder() has no reason to know about.
 *
 * Body: { memberId, items: [...], redeemedRewardId?: string, claimedBenefitId?: string }
 *
 * redeemedRewardId is validated and priced SERVER-SIDE (never trust a raw
 * discountAmount from the client) — see RedeemedReward in schema.prisma
 * for the redeem->checkout bridge this closes. VOUCHER rewards become a
 * discountAmount on the whole order (same discountAmount/voucherCode path
 * the kiosk's hardcoded vouchers already use in createOrder()); FREE_ITEM
 * rewards are simpler than originally planned — the linked product is just
 * appended to `items` at price 0, no discount-scoping needed. MERCHANDISE
 * is rejected here; those are claimed physically at the outlet.
 *
 * claimedBenefitId closes the same bridge for ClaimedBenefit (the automated
 * tier-upgrade/birthday/weekly-member-day rewards) — see applyClaimedBenefit
 * above. Both can be used in the same order since they're independent
 * wallets (member-initiated redeem vs. automatic system grant).
 */
export async function POST(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const body = await request.json();
  const { memberId, items, redeemedRewardId, claimedBenefitId } = body;

  if (!memberId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'memberId and a non-empty items array are required' }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  let discountAmount = 0;
  let orderItems: OrderItemInput[] = items.map((item: OrderItemInput) => ({ ...item }));
  let redeemedReward: Prisma.RedeemedRewardGetPayload<{ include: { rewardsCatalog: true } }> | null = null;

  if (redeemedRewardId) {
    redeemedReward = await prisma.redeemedReward.findUnique({
      where: { id: redeemedRewardId },
      include: { rewardsCatalog: true },
    });

    if (
      !redeemedReward ||
      redeemedReward.memberId !== memberId ||
      redeemedReward.status !== 'AVAILABLE' ||
      redeemedReward.expiresAt < new Date()
    ) {
      return NextResponse.json({ error: 'Redeemed reward is not available' }, { status: 400 });
    }

    const reward = redeemedReward.rewardsCatalog;
    if (reward.category === 'MERCHANDISE') {
      return NextResponse.json({ error: 'Merchandise rewards are claimed at the outlet, not at checkout' }, { status: 400 });
    }

    if (reward.category === 'VOUCHER') {
      const cartTotal = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
      discountAmount =
        reward.discountType === 'PERCENTAGE'
          ? Math.round((cartTotal * (reward.discountValue || 0)) / 100)
          : reward.discountValue || 0;
      discountAmount = Math.min(discountAmount, cartTotal);
    } else if (reward.category === 'FREE_ITEM') {
      if (!reward.linkedProductId) {
        return NextResponse.json({ error: 'Reward has no linked product' }, { status: 500 });
      }
      const posAdapter = await import('@/lib/integrations/pos.adapter');
      const menuItems = await posAdapter.getMenuItems();
      const product = menuItems.find((m) => m.id === reward.linkedProductId);
      if (!product) {
        return NextResponse.json({ error: 'Linked product is no longer available' }, { status: 400 });
      }
      orderItems.push({ productId: product.id, quantity: 1, price: 0, name: product.name });
    }
  }

  if (claimedBenefitId) {
    const result = await applyClaimedBenefit(claimedBenefitId, memberId, orderItems);
    if ('error' in result) {
      return result.error;
    }
    discountAmount += result.discountAmount;
  }

  try {
    const posAdapter = await import('@/lib/integrations/pos.adapter');
    const order = await posAdapter.createOrder(
      orderItems,
      member.name,
      discountAmount,
      undefined, // voucherCode
      member.phone
    );

    // createOrder() creates the local Order row without knowing about
    // members — tag it here instead of touching that shared function.
    await prisma.order.update({
      where: { id: order.orderId },
      data: { channel: 'MEMBER_APP', memberId },
    });

    if (redeemedReward) {
      await prisma.redeemedReward.update({
        where: { id: redeemedReward.id },
        data: { status: 'USED', usedInOrderId: order.orderId },
      });
    }

    if (claimedBenefitId) {
      await prisma.claimedBenefit.update({
        where: { id: claimedBenefitId },
        data: { status: 'CLAIMED', claimedAt: new Date(), usedInOrderId: order.orderId },
      });
    }

    return NextResponse.json({
      orderId: order.orderId,
      orderNo: order.orderNo,
      queueNumber: order.queueNumber,
    });
  } catch (err) {
    console.error('[Member Orders] Failed to create order:', err);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
