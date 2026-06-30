import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * GET /api/admin/reports/olsera
 *
 * Sales figures pulled DIRECTLY from Olsera (the source of truth), as a
 * cross-check against the local-Prisma dashboard. Revenue & order count come
 * from closed/settled orders; per-category and top-SKU come from Olsera's
 * report endpoints (best-effort — empty arrays if unavailable).
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const olsera = await import('@/lib/integrations/olsera.service');

    const [summary, byGroup, topSku] = await Promise.all([
      olsera.getOlseraSalesSummary(),
      olsera.getSalesByGroup(),
      olsera.getProductSalesBySku(undefined, undefined, 5),
    ]);

    return NextResponse.json({
      source: 'olsera',
      date: summary.date,
      revenue: summary.revenue,
      orders: summary.orders,
      avgOrderValue: summary.orders > 0 ? Math.round(summary.revenue / summary.orders) : 0,
      byGroup,
      topSku,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Olsera Reports API Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
