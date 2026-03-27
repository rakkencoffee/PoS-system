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
  const group = groups.find((g) => g.id === groupId);
  const groupName = String(group?.name || product.klasifikasi || product.category_name || product.product_group_name || product.group_name || 'Other');
  const groupSlug = slugify(groupName);

  // Price in Olsera API: "sell_price_pos" is Harga Jual Toko, "sell_price" is Harga Jual Online
  const rawPrice = product.sell_price_pos != null ? product.sell_price_pos : (product.sell_price || 0);
  const price = typeof rawPrice === 'string' ? parseFloat(rawPrice) : Number(rawPrice);
  
  const variants = product.variants || [];

  // Map variants to sizes if they look like size variants
  const sizes = variants.length > 0
    ? variants.map((v) => {
        const vPrice = v.sell_price_pos != null ? v.sell_price_pos : (v.sell_price || 0);
        const parsedVPrice = typeof vPrice === 'string' ? parseFloat(vPrice) : Number(vPrice);
        return {
          size: v.name,
          priceAdjustment: parsedVPrice - price,
        };
      })
    : [];

  return {
    id: String(product.id || product.product_id),
    name: product.name,
    description: product.description || '',
    price,
    image: product.photo_md || product.photo || product.image || '',
    // "pos_hidden": 0 means it's available in POS
    isAvailable: product.pos_hidden === 0 || product.is_active === 1 || product.is_active === true,
    isBestSeller: false,
    isRecommended: false,
    type: 'both',
    categoryId: String(groupId || 0),
    categoryName: groupName,
    categorySlug: groupSlug,
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
// Mappers: Prisma → Normalized
// ──────────────────────────────

interface PrismaMenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  isAvailable: boolean;
  isBestSeller: boolean;
  isRecommended: boolean;
  type: string;
  categoryId: number;
  category: { id: number; name: string; slug: string };
  sizes: { size: string; priceAdjustment: number }[];
}

interface PrismaCategory {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

function mapPrismaItem(item: PrismaMenuItem): NormalizedMenuItem {
  return {
    id: String(item.id),
    name: item.name,
    description: item.description,
    price: item.price,
    image: item.image,
    isAvailable: item.isAvailable,
    isBestSeller: item.isBestSeller,
    isRecommended: item.isRecommended,
    type: item.type,
    categoryId: String(item.categoryId),
    categoryName: item.category.name,
    categorySlug: item.category.slug,
    sizes: item.sizes,
  };
}

function mapPrismaCategory(cat: PrismaCategory): NormalizedCategory {
  return {
    id: String(cat.id),
    name: cat.name,
    slug: cat.slug,
    icon: cat.icon,
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
    const [products, groups] = await Promise.all([
      olsera.getProducts(),
      olsera.getProductGroups(),
    ]);

    let items = products.map((p) => mapOlseraProduct(p, groups));

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

  // Fallback: use Prisma
  const prisma = (await import('@/lib/prisma')).default;

  const where: Record<string, unknown> = {};
  if (!filters?.includeUnavailable) where.isAvailable = true;
  if (filters?.category) where.category = { slug: filters.category };
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { description: { contains: filters.search } },
    ];
  }
  if (filters?.type && filters.type !== 'all') {
    where.OR = [{ type: filters.type }, { type: 'both' }];
  }
  if (filters?.filter === 'best-seller') where.isBestSeller = true;
  if (filters?.filter === 'recommended') where.isRecommended = true;

  const items = await prisma.menuItem.findMany({
    where,
    include: { category: true, sizes: { orderBy: { size: 'asc' } } },
    orderBy: { name: 'asc' },
  });

  return (items as unknown as PrismaMenuItem[]).map(mapPrismaItem);
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<NormalizedCategory[]> {
  if (USE_OLSERA) {
    const groups = await olsera.getProductGroups();
    return groups.map(mapOlseraGroup);
  }

  // Fallback: use Prisma
  const prisma = (await import('@/lib/prisma')).default;
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  return (categories as unknown as PrismaCategory[]).map(mapPrismaCategory);
}

/**
 * Create order in POS system
 */
export async function createOrder(
  items: { productId: string; variantId?: string; quantity: number; price?: number; note?: string }[]
): Promise<{ orderId: string; olseraOrderId?: number }> {
  if (USE_OLSERA) {
    // 1. Create open order with items
    const order = await olsera.createOrder(items);
    const orderId = order.id || order.order_id;

    return {
      orderId: `OLSERA-${orderId}`,
      olseraOrderId: orderId,
    };
  }

  // Fallback: use Prisma
  const prisma = (await import('@/lib/prisma')).default;

  // Get queue number
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const lastOrder = await prisma.order.findFirst({
    where: { createdAt: { gte: todayStart } },
    orderBy: { queueNumber: 'desc' },
  });
  const queueNumber = (lastOrder?.queueNumber || 0) + 1;

  // Calculate total
  let totalAmount = 0;
  const orderItems: { menuItemId: number; quantity: number; size: string; subtotal: number; notes: string }[] = [];
  for (const item of items) {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(item.productId) },
      include: { sizes: true },
    });
    if (!menuItem) continue;

    let price = menuItem.price;
    if (item.variantId) {
      const size = menuItem.sizes.find((s: { size: string; priceAdjustment: number }) => s.size === item.variantId);
      if (size) price += size.priceAdjustment;
    }

    const subtotal = price * item.quantity;
    totalAmount += subtotal;
    orderItems.push({
      menuItemId: menuItem.id,
      quantity: item.quantity,
      size: item.variantId || 'M',
      subtotal,
      notes: item.note || '',
    });
  }

  const order = await prisma.order.create({
    data: {
      queueNumber,
      totalAmount,
      paymentMethod: 'MIDTRANS',
      items: { create: orderItems },
    },
  });

  return { orderId: String(order.id) };
}

/**
 * Update order status after payment
 */
export async function updateOrderPaymentStatus(
  orderId: string,
  status: 'paid' | 'failed' | 'expired'
): Promise<void> {
  if (USE_OLSERA && orderId.startsWith('OLSERA-')) {
    // POS Open APIs (like Olsera) typically rely on the Cashier to mark 
    // Open Orders as "Completed" and input the exact payment amount at the physical store.
    console.log(`[Olsera POS] Midtrans status for ${orderId} is ${status}. Wait for Cashier to complete.`);
    return;
  }

  // Fallback: update local DB
  const prisma = (await import('@/lib/prisma')).default;
  const dbStatus = status === 'paid' ? 'PREPARING' : 'CANCELLED';
  await prisma.order.update({
    where: { id: parseInt(orderId) },
    data: { status: dbStatus },
  });
}

/**
 * Check if Olsera integration is active
 */
export function isOlseraEnabled(): boolean {
  return USE_OLSERA;
}
