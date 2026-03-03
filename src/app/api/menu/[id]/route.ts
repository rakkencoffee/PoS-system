import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await prisma.menuItem.findUnique({
      where: { id: parseInt(id) },
      include: {
        category: true,
        sizes: { orderBy: { size: 'asc' } },
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    return NextResponse.json({ error: 'Failed to fetch menu item' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Update sizes if provided
    if (body.sizes) {
      await prisma.menuItemSize.deleteMany({
        where: { menuItemId: parseInt(id) },
      });
    }

    const item = await prisma.menuItem.update({
      where: { id: parseInt(id) },
      data: {
        name: body.name,
        description: body.description,
        price: body.price,
        image: body.image,
        categoryId: body.categoryId,
        isAvailable: body.isAvailable,
        isBestSeller: body.isBestSeller,
        isRecommended: body.isRecommended,
        type: body.type,
        sizes: body.sizes ? {
          create: body.sizes,
        } : undefined,
      },
      include: {
        category: true,
        sizes: true,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error updating menu item:', error);
    return NextResponse.json({ error: 'Failed to update menu item' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.menuItem.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: 'Menu item deleted' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return NextResponse.json({ error: 'Failed to delete menu item' }, { status: 500 });
  }
}
