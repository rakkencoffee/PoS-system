import { NextResponse } from 'next/server';
import { olseraFetch } from '@/lib/integrations/olsera.service';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Olsera's /product list (what the menu is built from) only carries the
// main photo; the full gallery is only on /product/detail, one call per
// product. Fetched lazily when CustomizeModal opens and cached, so a busy
// kiosk can't trip Olsera's rate limit (429 within seconds when every
// product's detail was fetched at once, confirmed 2026-11-04).
const TTL_SECONDS = 600;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json([], { status: 400 });

  const key = `olsera:photos:${id}`;
  try {
    const cached = await redis.get<string[]>(key);
    if (cached) return NextResponse.json(cached);
  } catch {
    /* Redis down: fall through to Olsera */
  }

  try {
    const res = await olseraFetch(`/product/detail?id=${id}`, { silent: true });
    if (!res.ok) return NextResponse.json([]);
    const photos: { photo_md?: string; view_order?: number }[] = (await res.json()).data?.photos || [];
    const urls = photos
      .sort((a, b) => (a.view_order ?? 0) - (b.view_order ?? 0))
      .map((p) => p.photo_md)
      .filter((u): u is string => !!u);
    try {
      await redis.set(key, urls, { ex: TTL_SECONDS });
    } catch {
      /* not cached this time, still serve it */
    }
    return NextResponse.json(urls);
  } catch {
    // The modal already shows the menu's main photo; an empty list just
    // means no extra slides.
    return NextResponse.json([]);
  }
}
