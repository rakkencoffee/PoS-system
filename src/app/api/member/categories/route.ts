import { NextRequest, NextResponse } from 'next/server';
import { getCategories } from '@/lib/integrations/pos.adapter';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/categories
 *
 * Same data as the kiosk's /api/categories (reuses getCategories()
 * directly, same Olsera-backed cache) — separate route only so it sits
 * behind the server-to-server x-api-key guard like the rest of
 * /api/member/*. Needed for the Menu page's category pill navigation
 * (mirrors kiosk's CategoryPills/useCategories()) — GET /api/member/menu
 * already accepts ?category= to filter, but had no way to list what
 * categories exist until now.
 */
export async function GET(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  try {
    const categories = await getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error('[Member Categories] Failed to fetch categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
