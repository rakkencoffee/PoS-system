import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const type = searchParams.get('type'); // hot, iced
    const filter = searchParams.get('filter'); // best-seller, recommended

    const where: Record<string, unknown> = {
      isAvailable: true,
    };

    if (category) {
      where.category = { slug: category };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (type && type !== 'all') {
      where.OR = [
        { type: type },
        { type: 'both' },
      ];
    }

    if (filter === 'best-seller') {
      where.isBestSeller = true;
    } else if (filter === 'recommended') {
      where.isRecommended = true;
    }

    const items = await prisma.menuItem.findMany({
      where,
      include: {
        category: true,
        sizes: {
          orderBy: { size: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
        sizes: body.sizes ? {
          create: body.sizes,
        } : undefined,
      },
      include: {
        category: true,
        sizes: true,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 });
  }
}
