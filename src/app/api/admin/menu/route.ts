import { NextResponse } from 'next/server';

const USE_OLSERA = process.env.USE_OLSERA === 'true';

// Admin endpoint - returns ALL items including unavailable ones
export async function GET() {
  try {
    if (USE_OLSERA) {
      // Use the existing pos.adapter which handles Olsera product fetching
      const posAdapter = await import('@/lib/integrations/pos.adapter');
      const items = await posAdapter.getMenuItems();
      return NextResponse.json(items);
    }

    // Fallback: Prisma
    const prisma = (await import('@/lib/prisma')).default;
    const items = await prisma.menuItem.findMany({
      include: {
        category: true,
        sizes: { orderBy: { size: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching all menu items:', error);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}
