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

/**
 * POST /api/member/orders
 *
 * Creates a pickup order for a member. Reuses pos.adapter.createOrder() —
 * the exact function the kiosk uses — so Olsera sync, queue numbers, and
 * kitchen print dispatch all behave identically to a kiosk order. The only
 * addition is tagging the resulting Order row with channel=MEMBER_APP and
 * memberId, which createOrder() has no reason to know about.
 *
 * Body: { memberId, items: [...], redeemedRewardId?: string }
 *
 * redeemedRewardId is validated and priced SERVER-SIDE (never trust a raw
 * discountAmount from the client) — see RedeemedReward in schema.prisma
 * for the redeem->checkout bridge this closes. VOUCHER rewards become a
 * discountAmount on the whole order (same discountAmount/voucherCode path
 * the kiosk's hardcoded vouchers already use in createOrder()); FREE_ITEM
 * rewards are simpler than originally planned — the linked product is just
 * appended to `items` at price 0, no discount-scoping needed. MERCHANDISE
 * is rejected here; those are claimed physically at the outlet.
 */
export async function POST(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const body = await request.json();
  const { memberId, items, redeemedRewardId } = body;

  if (!memberId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'memberId and a non-empty items array are required' }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  let discountAmount = 0;
  let orderItems = items;
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
      orderItems = [...items, { productId: product.id, quantity: 1, price: 0, name: product.name }];
    }
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
