import { prisma } from '../db';
import { olseraApi } from './olsera';
import { redis } from '../redis';

/**
 * OLSERA SYNC ENGINE
 * 
 * Choice A: Olsera is Master.
 * This script pulls data from Olsera and populates the local ProductCache.
 */

export async function syncProductsFromOlsera() {
  console.log('[Sync] 🔄 Starting product sync from Olsera...');
  const startTime = Date.now();

  try {
    // 1. Fetch all products from Olsera
    const products = await olseraApi.getProducts();
    console.log(`[Sync] Found ${products.length} products in Olsera.`);

    // 2. Map and Upsert to Neon
    const upsertPromises = products.map((p) => {
      return prisma.productCache.upsert({
        where: { olseraId: String(p.id || p.product_id) },
        update: {
          name: p.name,
          description: p.description || '',
          price: Math.round(Number(p.sell_price || p.price || 0)),
          stock: Math.round(Number(p.stock || 0)),
          category: p.product_group_name || p.group_name || 'Uncategorized',
          imageUrl: p.photo || p.image || null,
          isActive: Boolean(p.is_active),
          cachedAt: new Date(),
        },
        create: {
          olseraId: String(p.id || p.product_id),
          name: p.name,
          description: p.description || '',
          price: Math.round(Number(p.sell_price || p.price || 0)),
          stock: Math.round(Number(p.stock || 0)),
          category: p.product_group_name || p.group_name || 'Uncategorized',
          imageUrl: p.photo || p.image || null,
          isActive: Boolean(p.is_active),
          cachedAt: new Date(),
        }
      });
    });

    // Execute in chunks to avoid overwhelming the database
    const chunkSize = 20;
    for (let i = 0; i < upsertPromises.length; i += chunkSize) {
      await Promise.all(upsertPromises.slice(i, i + chunkSize));
      console.log(`[Sync] Progress: ${Math.min(i + chunkSize, products.length)}/${products.length}`);
    }

    // 3. Clear Redis L1 Cache
    await redis.del('products:all');

    // 4. Log success
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    await prisma.olseraSyncLog.create({
      data: {
        type: 'product_sync',
        status: 'success',
        itemsSynced: products.length,
      }
    });

    console.log(`[Sync] ✅ Sync completed in ${duration}s`);
    return { success: true, count: products.length };

  } catch (err: any) {
    console.error('[Sync] ❌ Sync failed:', err);

    await prisma.olseraSyncLog.create({
      data: {
        type: 'product_sync',
        status: 'failed',
        errorMsg: err.message,
      }
    });

    throw err;
  }
}

/**
 * Partial Sync for stock levels only
 */
export async function syncStockFromOlsera(olseraId?: string) {
  if (olseraId) {
    const stock = await olseraApi.getProductStock(olseraId);
    await prisma.productCache.update({
      where: { olseraId },
      data: { stock }
    });
    return { success: true };
  }

  // If no specific product, trigger full product sync (which includes stock)
  return syncProductsFromOlsera();
}
