import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const toppings = await prisma.topping.findMany({
      where: { isAvailable: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(toppings);
  } catch (error) {
    console.error('Error fetching toppings:', error);
    return NextResponse.json({ error: 'Failed to fetch toppings' }, { status: 500 });
  }
}
