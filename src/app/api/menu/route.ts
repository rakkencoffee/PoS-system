import { NextRequest, NextResponse } from 'next/server';
import { getMenuItems } from '@/lib/integrations/pos.adapter';

/**
 * GET /api/menu
 *
 * Fetches menu items from Olsera POS (if enabled) or local database.
 * Supports filters: category, search, type, filter (best-seller/recommended)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const type = searchParams.get('type') || undefined;
    const filter = searchParams.get('filter') || undefined;

    const items = await getMenuItems({ category, search, type, filter });

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}

/**
 * POST /api/menu — Create menu item (admin, local DB only)
 */
export async function POST(request: NextRequest) {
  try {
    const prisma = (await import('@/lib/prisma')).default;
    const body = await request.json();
    const item = await prisma.menuItem.create({
      data: {
        name: body.name,
        description: body.description || '',
        price: body.price,
        image: body.image || '',
        categoryId: body.categoryId,
        isAvailable: body.isAvailable ?? true,
        isBestSeller: body.isBestSeller ?? false,
        isRecommended: body.isRecommended ?? false,
        type: body.type || 'both',
        sizes: body.sizes ? { create: body.sizes } : undefined,
      },
      include: { category: true, sizes: true },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 });
  }
}
