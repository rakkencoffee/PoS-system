import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

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
      member.phone,
      null // station — no physical kiosk tablet for Member App orders
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
