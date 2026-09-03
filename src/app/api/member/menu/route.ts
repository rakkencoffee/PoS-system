import { NextRequest, NextResponse } from 'next/server';
import { getMenuItems } from '@/lib/integrations/pos.adapter';
import { requireMemberApiKey } from '@/lib/member-api-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/member/menu
 *
 * Same data as the kiosk's /api/menu (reuses getMenuItems() directly, same
 * Olsera-backed cache) — separate route only so it sits behind the
 * server-to-server x-api-key guard like the rest of /api/member/*.
 */
export async function GET(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;

    const items = await getMenuItems({ category, search });
    return NextResponse.json(items);
  } catch (error) {
    console.error('[Member Menu] Failed to fetch menu items:', error);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}
