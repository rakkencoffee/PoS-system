import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/orders/:id?memberId=...
 *
 * Single order detail — used by both the e-receipt (Detail Riwayat) and the
 * Tracking page. memberId is required and checked so a member can't read
 * another member's order by guessing an orderId.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id } = await params;
  const memberId = request.nextUrl.searchParams.get('memberId');
  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, pointLedgerEntries: true },
  });

  if (!order || order.memberId !== memberId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const pointsEarned = order.pointLedgerEntries
    .filter((entry) => entry.type === 'EARN')
    .reduce((sum, entry) => sum + entry.amount, 0);

  return NextResponse.json({
    id: order.id,
    status: order.status,
    baristaStatus: order.baristaStatus,
    kitchenStatus: order.kitchenStatus,
    total: order.total,
    createdAt: order.createdAt,
    pointsEarned,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
      notes: item.notes,
    })),
  });
}
