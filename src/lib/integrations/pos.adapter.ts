/**
 * POS Adapter
 *
 * Provides a unified interface that can use either Olsera POS API
 * or the local Prisma/Supabase database as the data source.
 *
 * Controlled by USE_OLSERA environment variable:
 * - true  → fetch data from Olsera API
 * - false → fetch data from local Prisma database (development fallback)
 */

import * as olsera from './olsera.service';
import type { OlseraProduct, OlseraProductGroup } from './olsera.service';

const USE_OLSERA = process.env.USE_OLSERA === 'true';

// ──────────────────────────────
// In-Memory Cache for Test Resiliency
// ──────────────────────────────
let olseraCache = {
  products: null as NormalizedMenuItem[] | null,
  categories: null as NormalizedCategory[] | null,
  timestamp: 0,
};
const CACHE_TTL_MS = 60000; // 1 minute cache

// ──────────────────────────────
// Normalized data types used by the UI
// ──────────────────────────────

export interface NormalizedMenuItem {
  id: string; // string to support both systems
  name: string;
  description: string;
  price: number;
  image: string;
  isAvailable: boolean;
  isBestSeller: boolean;
  isRecommended: boolean;
  type: string; // 'hot' | 'iced' | 'both'
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  category: { name: string };
  sizes: { size: string; priceAdjustment: number }[];
  olseraProductId?: number;
  olseraVariants?: { id: number; name: string; price: number }[];
}

export interface NormalizedCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

// ──────────────────────────────
// Mappers: Olsera → Normalized
// ──────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  coffee: '☕',
  'coffee-based': '☕',
  'non-coffee': '🧋',
  'milk-based': '🥛',
  refreshment: '🍹',
  pastry: '🍰',
  dessert: '🧁',
  snack: '🍿',
  'main-course': '🍝',
  'add-ons': '✨',
  default: '📦',
};

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function mapOlseraProduct(product: OlseraProduct, groups: OlseraProductGroup[]): NormalizedMenuItem {
  const groupId = product.product_group_id || product.klasifikasi_id || product.category_id;
  const group = groups.find((g) => String(g.id) === String(groupId));
  const groupName = String(
    group?.name || 
    product.klasifikasi || 
    product.category_name || 
    product.product_group_name || 
    product.group_name || 
    'Other'
  );
  const groupSlug = slugify(groupName);

  // Price in Olsera API: "sell_price_pos" is Harga Jual Toko, "sell_price" is Harga Jual Online
  const rawPrice = product.sell_price_pos != null ? product.sell_price_pos : (product.sell_price || 0);
  const price = typeof rawPrice === 'string' ? parseFloat(rawPrice) : Number(rawPrice);
  
  const variants = product.variants || [];

  // Map variants to sizes if they look like size variants
  let sizes = variants.length > 0
    ? variants.map((v) => {
        const vPrice = v.sell_price_pos != null ? v.sell_price_pos : (v.sell_price || 0);
        const parsedVPrice = typeof vPrice === 'string' ? parseFloat(vPrice) : Number(vPrice);
        return {
          size: v.name,
          priceAdjustment: parsedVPrice - price,
        };
      })
    : [];

  // Fallback for drinks (Coffee/Milk based) that might not have variants in Olsera but need size selection in Kiosk
  if (sizes.length === 0 && (groupSlug === 'coffee-based' || groupSlug === 'milk-based' || groupSlug === 'coffee')) {
    sizes = [{ size: 'Regular', priceAdjustment: 0 }];
  }

  return {
    id: String(product.id || product.product_id),
    name: product.name,
    description: product.description || '',
    price,
    image: product.photo_md || product.photo || product.image || '',
    // "pos_hidden": 0 means it's available in POS
    isAvailable: Number(product.pos_hidden) === 0 || Number(product.is_active) === 1 || product.is_active === true,
    isBestSeller: false,
    isRecommended: false,
    type: 'both',
    categoryId: String(groupId || 0),
    categoryName: groupName,
    categorySlug: groupSlug,
    category: { name: groupName },
    sizes,
    olseraProductId: product.id || product.product_id,
    olseraVariants: variants.map((v) => {
      const vPrice = v.sell_price_pos != null ? v.sell_price_pos : (v.sell_price || 0);
      return {
        id: v.id || v.variant_id || 0,
        name: v.name,
        price: typeof vPrice === 'string' ? parseFloat(vPrice) : Number(vPrice),
      };
    }),
  };
}

function mapOlseraGroup(group: OlseraProductGroup): NormalizedCategory {
  const slug = slugify(group.name);
  return {
    id: String(group.id),
    name: group.name,
    slug,
    icon: CATEGORY_ICONS[slug] || CATEGORY_ICONS.default,
  };
}

// ──────────────────────────────
// Public API
// ──────────────────────────────

/**
 * Get all menu items (products)
 */
export async function getMenuItems(filters?: {
  category?: string;
  search?: string;
  type?: string;
  filter?: string;
  includeUnavailable?: boolean;
}): Promise<NormalizedMenuItem[]> {
  if (USE_OLSERA) {
    const isCacheExpired = Date.now() - olseraCache.timestamp > CACHE_TTL_MS;
    
    if (isCacheExpired || !olseraCache.products) {
      const [products, groups] = await Promise.all([
        olsera.getProducts(),
        olsera.getProductGroups(),
      ]);
      // Reverse the order so newest/added-later items appear first as per user request
      olseraCache.products = products.map((p) => mapOlseraProduct(p, groups)).reverse();
      olseraCache.timestamp = Date.now();
    }

    let items = olseraCache.products || [];

    // Apply filters
    if (!filters?.includeUnavailable) {
      items = items.filter((i) => i.isAvailable);
    }
    if (filters?.category) {
      items = items.filter((i) => i.categorySlug === filters.category);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
      );
    }

    return items;
  }
  // Fallback removed
  throw new Error('Local database (Prisma) is no longer supported. Please ensure Olsera configuration is active in Vercel.');
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<NormalizedCategory[]> {
  // Custom display order: lower number = higher priority (shown first)
  const CATEGORY_ORDER: Record<string, number> = {
    'coffee-based': 1,
    'milk-based': 2,
    'main-course': 3,
    'dessert': 4,
    'snack': 5,
    'refreshment': 6,
  };

  if (USE_OLSERA) {
    const isCacheExpired = Date.now() - olseraCache.timestamp > CACHE_TTL_MS;
    
    if (isCacheExpired || !olseraCache.categories) {
      const groups = await olsera.getProductGroups();
      olseraCache.categories = groups.map(mapOlseraGroup).sort((a, b) => (CATEGORY_ORDER[a.slug] ?? 99) - (CATEGORY_ORDER[b.slug] ?? 99));
    }
    
    return olseraCache.categories || [];
  }
  // Fallback removed
  throw new Error('Local database (Prisma) is no longer supported.');
}

/**
 * Create order in POS system
 */
export async function createOrder(
  items: { productId: string; variantId?: string; quantity: number; price?: number; note?: string }[],
  customerName?: string
): Promise<{ orderId: string; olseraOrderId?: number }> {
  if (USE_OLSERA) {
    // 1. Create open order
    const order = await olsera.createOrder([], { customer_name: customerName }); // create empty order first with customer name if possible
    const orderId = (order.id || order.order_id) as number;

    // 2. Add each item separately as required by Olsera API
    for (const item of items) {
      if (!item.productId) continue;
      try {
        await olsera.addItemToOrder(
          orderId,
          parseInt(item.productId),
          item.variantId ? parseInt(item.variantId) : null,
          item.quantity,
          item.note || ''
        );
      } catch (err) {
        console.error(`Failed to add item ${item.productId} to order ${orderId}:`, err);
      }
    }

    return {
      orderId: `OLSERA-${orderId}`,
      olseraOrderId: orderId,
    };
  }
  // Fallback removed
  throw new Error('Local database (Prisma) is no longer supported for creating orders.');
}

/**
 * Update order status after payment
 * For Olsera: runs the full auto-settlement flow
 */
export async function updateOrderPaymentStatus(
  orderId: string,
  status: 'paid' | 'failed' | 'expired',
  paymentAmount?: number
): Promise<void> {
  if (USE_OLSERA && orderId.startsWith('OLSERA-')) {
    const olseraOrderId = parseInt(orderId.replace('OLSERA-', ''));

    if (status === 'paid') {
      let paymentModeId: number | undefined = undefined;

      try {
        // Step 1: Get payment methods to find QRIS/Midtrans mode ID
        // (This API randomly returns 500 on Sandbox, so we wrap it)
        const paymentMethods = await olsera.getPaymentMethods();
        const targetNames = ['qris', 'midtrans', 'e-wallet', 'ewallet', 'online', 'transfer'];
        paymentModeId = paymentMethods[0]?.id;
        
        for (const method of paymentMethods) {
          const name = String(method.name).toLowerCase();
          if (targetNames.some((t) => name.includes(t))) {
            paymentModeId = method.id;
            break;
          }
        }
      } catch (paymentDetailsError) {
        console.warn(`[Auto-Settlement] Non-fatal: Could not fetch payment methods from Olsera. Falling back to default ID 1.`);
        paymentModeId = 1; // Fallback to 1 (usually Cash/Default)
      }

      try {
        // Step 2: Record payment details on the order
        // Fetch the absolute source of truth for the total from Olsera to avoid 406 "Incorrect payment amount"
        const orderDetail = await olsera.getOrderDetail(orderId);
        const actualOlseraTotal = orderDetail.total ? parseFloat(String(orderDetail.total)) : (paymentAmount || 0);
        
        // Skip if already paid in Olsera to avoid duplicate settlement errors
        if (orderDetail.is_paid === true || orderDetail.is_paid === 1 || orderDetail.is_paid === '1') {
          console.log(`[Auto-Settlement] Order ${orderId} already marked as PAID in Olsera. Skipping settlement.`);
          return;
        }

        if (actualOlseraTotal > 0 && paymentModeId) {
          try {
            console.log(`[Auto-Settlement] Initializing settlement for Olsera order ${orderId} with amount: ${actualOlseraTotal}`);
            await olsera.updateOrderPayment(olseraOrderId, actualOlseraTotal, paymentModeId);
            
            // CRITICAL: Also mark as Paid (status=1) so Olsera allows status updates to A/Z later
            await olsera.markOrderAsPaid(olseraOrderId, true);
            console.log(`[Auto-Settlement] Successfully recorded payment info for order ${orderId}`);
            
            // FORCE status back to PENDING (P)
            // Olsera sometimes auto-accepts orders and moves them to 'A' (Preparing).
            // We force it back to 'P' so it appears in the first column of the KDS.
            await olsera.updateOrderStatus(olseraOrderId, 'P');
            console.log(`[Auto-Settlement] Forced status to PENDING for order ${orderId}`);
          } catch (paymentAppendError: any) {
            console.warn(`[Auto-Settlement] Non-fatal: Could not append payment details to Olsera order ${orderId}:`, paymentAppendError.message);
          }
        }

        // Step 3: Keep order in Pending (P) so it stays in Column 1 of KDS
        // The Barista will manually move it to PREPARING (A) by clicking "Start Making"
        console.log(`[Auto-Settlement] ✅ Order ${orderId} marked as PAID. Staying in PENDING for KDS check.`);
      } catch (error: any) {
        // Log but don't throw — webhook must still return 200 to Midtrans
        console.error(`[Auto-Settlement] ❌ Failed to settle order ${orderId} in Olsera:`, error.message);
      }
    } else {
      console.log(`[Olsera POS] Order ${orderId} status: ${status}. No Olsera action needed.`);
    }
    return;
  }
  // Fallback removed
  console.warn(`[Auto-Settlement] Order ${orderId} does not exist in Olsera POS or is unsupported. Escaping Prisma update.`);
  return;
}

/**
 * Check if Olsera integration is active
 */
export function isOlseraEnabled(): boolean {
  return USE_OLSERA;
}
