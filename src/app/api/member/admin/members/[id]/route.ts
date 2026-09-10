import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/admin/members/:id
 *
 * Member detail + order history for the admin member-detail drill-down —
 * GET /api/member/admin/members (list) only returns a summary row
 * (_count.orders), this is the "lihat riwayat order per member" capability
 * the PRD always wanted but never got its own endpoint. Capped at the 50
 * most recent orders — a detail page has no reason to load a member's
 * entire history at once.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id } = await params;

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { items: true },
      },
    },
  });

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: member.id,
    name: member.name,
    email: member.email,
    phone: member.phone,
    birthDate: member.birthDate,
    pointBalance: member.pointBalance,
    tierLevel: member.tierLevel,
    tierPeriodStart: member.tierPeriodStart,
    tierPeriodSpend: member.tierPeriodSpend,
    createdAt: member.createdAt,
    orders: member.orders.map((order) => ({
      id: order.id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({ name: item.name, quantity: item.quantity })),
    })),
  });
}
