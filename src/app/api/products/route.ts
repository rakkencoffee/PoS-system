import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';

/**
 * GET /api/products
 * 
 * Fetches menu items with two-layer caching:
 * 1. Redis (In-memory, extremely fast) - TTL 1 hour
 * 2. Neon (PostgreSQL, local cache) - Source of truth for POS
 */

export async function GET() {
  const CACHE_KEY = 'products:all';

  try {
    // LAYER 1: Redis Cache
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      console.log('[API] Serving products from Redis (L1 Cache)');
      return NextResponse.json(cached);
    }

    // LAYER 2: Neon (ProductCache Table)
    console.log('[API] Cache miss. Serving products from Neon (L2 Cache)');
    const products = await prisma.productCache.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' }
    });

    // Repopulate Redis
    if (products.length > 0) {
      await redis.set(CACHE_KEY, products, { ex: 3600 }); // Cache for 1 hour
    }

    return NextResponse.json(products);
  } catch (err: any) {
    console.error('[API] Error fetching products:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
