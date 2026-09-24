import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Same roles the main /api/orders KDS feed requires.
const ALLOWED_ROLES = ['KITCHEN', 'ADMIN'];

/**
 * Start of "today" in WIB -- same convention as /api/orders' own
 * startOfTodayWIB(), duplicated locally rather than shared since both
 * routes already keep their own copy.
 */
function startOfTodayWIB(): Date {
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const wibNow = new Date(Date.now() + wibOffsetMs);
  const wibMidnightAsUTC = new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()));
  return new Date(wibMidnightAsUTC.getTime() - wibOffsetMs);
}

/**
 * GET /api/orders/cancelled-today
 *
 * A cancelled order is intentionally invisible on the main KDS board (see
 * api/orders/route.ts's status filter) -- but that makes queue numbers
 * appear to "skip" with no explanation on screen, which repeatedly got
 * mistaken for a bug on 2026-09-24 (a customer backing out of EDC/QRIS
 * payment before it completes is the normal, expected cause). This is a
 * separate, isolated endpoint on purpose: it never touches the main
 * /api/orders query or its response shape, so this purely-cosmetic addition
 * carries zero risk to the board staff actively work off of.
 */
export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!session?.user || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cancelled = await prisma.order.findMany({
      where: {
        createdAt: { gte: startOfTodayWIB() },
        status: 'CANCELLED',
      },
      select: { queueNumber: true },
      orderBy: { queueNumber: 'asc' },
    });

    const queueNumbers = cancelled
      .map((o) => o.queueNumber)
      .filter((n): n is number => n != null);

    return NextResponse.json({ queueNumbers });
  } catch (error) {
    console.error('Error fetching cancelled orders:', error);
    return NextResponse.json({ error: 'Failed to fetch cancelled orders' }, { status: 500 });
  }
}
