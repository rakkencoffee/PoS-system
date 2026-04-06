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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch menu items', details: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'POST to /api/menu is deprecated. Menu management is handled via Olsera Dashboard.' },
    { status: 501 }
  );
}
