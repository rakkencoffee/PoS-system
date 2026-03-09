import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/integrations/pos.adapter';

/**
 * GET /api/categories
 *
 * Fetches categories from Olsera POS (if enabled) or local database.
 */
export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
