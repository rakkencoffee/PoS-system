import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    // LAYER 1: Redis Cache (with failover)
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        console.log('[API] Serving products from Redis (L1 Cache)');
        return NextResponse.json(cached);
      }
    } catch (redisErr) {
      console.warn('[API] Redis L1 Cache failed, falling back to Neon:', redisErr);
    }

    // LAYER 2: Neon (ProductCache Table)
    console.log('[API] Serving products from Neon (L2 Cache)');
    const products = await prisma.productCache.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' }
    });

    // Repopulate Redis (asynchronously to not block response)
    if (products.length > 0) {
      redis.set(CACHE_KEY, products, { ex: 3600 }).catch(err => 
        console.error('[API] Failed to update Redis cache:', err)
      );
    }

    return NextResponse.json(products);
  } catch (err: any) {
    console.error('[API] Critical error fetching products:', err);
    
    // Detailed error reporting for debugging
    return NextResponse.json({ 
      error: 'Database Connection Error',
      message: err.message,
      code: err.code
    }, { status: 500 });
  }
}
