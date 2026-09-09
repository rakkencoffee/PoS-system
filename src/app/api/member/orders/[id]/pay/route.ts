import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';
import { createQrisTransaction } from '@/lib/integrations/tripay.service';

/**
 * POST /api/member/orders/:id/pay
 *
 * Creates a Tripay QRIS2 transaction for a pending Member App order and
 * returns the QR to render inline on the checkout page. Settlement happens
 * separately via the Tripay callback (see /api/webhooks/tripay) — this
 * endpoint only starts the payment, it never marks the order paid itself.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, member: true },
  });

  if (!order || order.channel !== 'MEMBER_APP' || !order.member) {
    return NextResponse.json({ error: 'Member order not found' }, { status: 404 });
  }
  if (order.status !== 'PENDING') {
    return NextResponse.json({ error: 'Order is not awaiting payment' }, { status: 409 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  try {
    const tx = await createQrisTransaction({
      merchantRef: order.id,
      amount: order.total,
      customerName: order.member.name,
      customerEmail: order.member.email,
      customerPhone: order.member.phone,
      orderItems: order.items.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      callbackUrl: `${baseUrl}/api/webhooks/tripay`,
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { tripayReference: tx.reference },
    });

    return NextResponse.json({ qrUrl: tx.qrUrl, reference: tx.reference });
  } catch (err) {
    console.error('[Member Pay] Failed to create Tripay transaction:', err);
    return NextResponse.json({ error: 'Failed to start payment' }, { status: 500 });
  }
}
