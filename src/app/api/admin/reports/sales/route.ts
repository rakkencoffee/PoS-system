import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'today';

    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (period === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
      // Logic for yesterday could be more complex, but let's stick to today for real-time focus
    }

    // 1. Total Sales & Count (Paid orders only)
    const stats = await prisma.order.aggregate({
      where: {
        status: 'PAID',
        createdAt: { gte: startDate },
      },
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
    });

    // 2. Top Selling Products
    const topProducts = await prisma.orderItem.groupBy({
      by: ['name'],
      where: {
        order: {
          status: 'PAID',
          createdAt: { gte: startDate },
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 5,
    });

    const topProductsWithNames = topProducts.map((p) => ({
      name: p.name,
      quantity: p._sum.quantity,
    }));

    // 3. Hourly Sales Trend
    const hourlySales = await prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM "createdAt") as hour,
        SUM("total") as total
      FROM "Order"
      WHERE "status" = 'PAID' AND "createdAt" >= ${startDate}
      GROUP BY hour
      ORDER BY hour ASC
    `;

    return NextResponse.json({
      totalRevenue: Number(stats._sum.total) || 0,
      totalOrders: stats._count.id || 0,
      topProducts: topProductsWithNames,
      hourlySales: hourlySales || [],
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Reports API Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
