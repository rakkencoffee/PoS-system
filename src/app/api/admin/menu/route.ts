import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Admin endpoint - returns ALL items including unavailable ones
export async function GET() {
  try {
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
