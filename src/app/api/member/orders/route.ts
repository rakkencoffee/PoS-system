import { NextRequest, NextResponse } from 'next/server';
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
 * Body: { memberId, items: [{ productId, variantId?, quantity, price, name, note?, options? }] }
 */
export async function POST(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const body = await request.json();
  const { memberId, items } = body;

  if (!memberId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'memberId and a non-empty items array are required' }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  try {
    const posAdapter = await import('@/lib/integrations/pos.adapter');
    const order = await posAdapter.createOrder(
      items,
      member.name,
      0, // discountAmount — reward redemption (Bab 5) not wired to this endpoint yet
      undefined, // voucherCode
      member.phone
    );

    // createOrder() creates the local Order row without knowing about
    // members — tag it here instead of touching that shared function.
    await prisma.order.update({
      where: { id: order.orderId },
      data: { channel: 'MEMBER_APP', memberId },
    });

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
