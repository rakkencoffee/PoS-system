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

import * as olsera from "./olsera.service";
import type { OlseraProduct, OlseraProductGroup } from "./olsera.service";
import { logOrderStatusChange, type StatusLogSource } from "@/lib/order-status-log";

const USE_OLSERA = process.env.USE_OLSERA === "true";

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
  "rakken-signature": "☕",
  "rakken-style": "☕",
  "non-coffee": "🧋",
  refreshment: "🍹",
  dessert: "🧁",
  bites: "🥐",
  "main-course": "🍝",
  coffee: "☕",
  "coffee-based": "☕",
  "milk-based": "🥛",
  pastry: "🍰",
  snack: "🍿",
  "add-ons": "✨",
  default: "📦",
};

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapOlseraProduct(
  product: OlseraProduct,
  groups: OlseraProductGroup[],
): NormalizedMenuItem {
  const groupId =
    product.product_group_id || product.klasifikasi_id || product.category_id;
  const group = groups.find((g) => String(g.id) === String(groupId));
  const groupName = String(
    group?.name ||
      product.klasifikasi ||
      product.category_name ||
      product.product_group_name ||
      product.group_name ||
      "Other",
  );
  const groupSlug = slugify(groupName);

  // Price in Olsera API: "sell_price_pos" is Harga Jual Toko, "sell_price" is Harga Jual Online
  const rawPrice =
    product.sell_price_pos != null
      ? product.sell_price_pos
      : product.sell_price || 0;
  const price =
    typeof rawPrice === "string" ? parseFloat(rawPrice) : Number(rawPrice);

  const variants = product.variants || [];

  // Map variants to sizes if they look like size variants
  let sizes =
    variants.length > 0
      ? variants.map((v) => {
          const vPrice =
            v.sell_price_pos != null ? v.sell_price_pos : v.sell_price || 0;
          const parsedVPrice =
            typeof vPrice === "string" ? parseFloat(vPrice) : Number(vPrice);
          return {
            size: v.name,
            priceAdjustment: parsedVPrice - price,
          };
        })
      : [];

  // Fallback for drinks (Coffee/Milk based) that might not have variants in Olsera but need size selection in Kiosk
  if (
    sizes.length === 0 &&
    (groupSlug === "coffee-based" ||
      groupSlug === "milk-based" ||
      groupSlug === "coffee")
  ) {
    sizes = [{ size: "Regular", priceAdjustment: 0 }];
  }

  return {
    id: String(product.id || product.product_id),
    name: product.name,
    description: product.description || "",
    price,
    image: product.photo_md || product.photo || product.image || "",
    // "pos_hidden": 0 means it's available in POS
    isAvailable:
      Number(product.pos_hidden) === 0 ||
      Number(product.is_active) === 1 ||
      product.is_active === true,
    isBestSeller: false,
    isRecommended: false,
    type: "both",
    categoryId: String(groupId || 0),
    categoryName: groupName,
    categorySlug: groupSlug,
    category: { name: groupName },
    sizes,
    olseraProductId: product.id || product.product_id,
    olseraVariants: variants.map((v) => {
      const vPrice =
        v.sell_price_pos != null ? v.sell_price_pos : v.sell_price || 0;
      return {
        id: v.id || v.variant_id || 0,
        name: v.name,
        price: typeof vPrice === "string" ? parseFloat(vPrice) : Number(vPrice),
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
      olseraCache.products = products
        .map((p) => mapOlseraProduct(p, groups))
        .reverse();
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
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q),
      );
    }

    return items;
  }
  // Fallback removed
  throw new Error(
    "Local database (Prisma) is no longer supported. Please ensure Olsera configuration is active in Vercel.",
  );
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<NormalizedCategory[]> {
  // Custom display order: lower number = higher priority (shown first)
  const CATEGORY_ORDER: Record<string, number> = {
    "rakken-signature": 1,
    "rakken-style": 2,
    "non-coffee": 3,
    refreshment: 4,
    dessert: 5,
    bites: 6,
    "main-course": 7,
  };

  if (USE_OLSERA) {
    const isCacheExpired = Date.now() - olseraCache.timestamp > CACHE_TTL_MS;

    if (isCacheExpired || !olseraCache.categories) {
      const groups = await olsera.getProductGroups();
      olseraCache.categories = groups
        .map(mapOlseraGroup)
        .sort(
          (a, b) =>
            (CATEGORY_ORDER[a.slug] ?? 99) - (CATEGORY_ORDER[b.slug] ?? 99),
        );
    }

    return olseraCache.categories || [];
  }
  // Fallback removed
  throw new Error("Local database (Prisma) is no longer supported.");
}

function formatOptionsWithToppings(options: any): string {
  if (!options) return "";
  const optParts = [];
  if (options.size && options.size !== "-") optParts.push(`Size: ${options.size}`);
  if (options.sugarLevel && options.sugarLevel !== "-") optParts.push(`${options.sugarLevel} Sugar`);
  if (options.iceLevel && options.iceLevel !== "-") optParts.push(`${options.iceLevel} Ice`);
  if (options.extraShot) optParts.push("Extra Shot");
  
  if (Array.isArray(options.toppings) && options.toppings.length > 0) {
    const TOPPING_MAP: Record<string | number, string> = {
      9001: "Almond Milk",
      9002: "Espresso Shot",
      9003: "Whip Cream",
      9004: "Sea Salt Cream",
      9005: "Cheese Cream",
      "milk-skim": "Skim Milk",
      "milk-oat": "Oat Milk",
      "beans-png-signature": "PNG Signature",
      "shot-extra-1": "Extra 1 Shot",
      "shot-extra-2": "Extra 2 Shots",
    };
    const toppingsStr = options.toppings
      .map((tId: string | number) => TOPPING_MAP[tId] || String(tId))
      .join(", ");
    if (toppingsStr) optParts.push(toppingsStr);
  }
  
  return optParts.join(", ");
}

/**
 * Create order in POS system
 */
// Background task helper that works in Next.js runtime and Node CLI tests
const runInBackground = (fn: () => Promise<any> | any) => {
  import("next/server")
    .then(({ after }) => {
      if (typeof after === "function") {
        after(fn);
      } else {
        Promise.resolve(fn()).catch((err) => {
          console.error("[Background Error] Task failed:", err);
        });
      }
    })
    .catch(() => {
      // Fallback for environments without next/server (CLI scripts)
      Promise.resolve(fn()).catch((err) => {
        console.error("[Background Error] Task failed:", err);
      });
    });
};

/**
 * Create order in POS system
 */
export async function createOrder(
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    price?: number;
    note?: string;
    name?: string;
    options?: any;
  }[],
  customerName?: string,
  discountAmount: number = 0,
  voucherCode?: string,
  customerPhone?: string,
): Promise<{ orderId: string; olseraOrderId?: number; orderNo?: string; queueNumber?: number }> {
  if (USE_OLSERA) {
    // CRM (F5): if the customer left a phone number, try to match an existing
    // Olsera customer so the order is linked to their profile/history.
    let matchedCustomer: { id: number | string; name: string } | null = null;
    if (customerPhone && customerPhone.replace(/\D/g, '').length >= 8) {
      try {
        matchedCustomer = await olsera.findCustomerByPhone(customerPhone);
        if (matchedCustomer) {
          console.log(`[CRM] Matched existing customer #${matchedCustomer.id} (${matchedCustomer.name}) by phone`);
        }
      } catch (crmErr) {
        console.warn('[CRM] Customer lookup failed (non-blocking):', crmErr);
      }
    }

    // 1. Create open order (Header only) - VERY FAST (<500ms)
    // The name typed at checkout always wins — matchedCustomer is only used
    // to LINK order history (customer_id), never to override what the
    // customer actually entered. Its name is a fallback purely for the case
    // where no name was typed at all.
    const order = await olsera.createOrder([], {
      customer_name: customerName || matchedCustomer?.name,
      customer_phone: customerPhone,
      customer_id: matchedCustomer?.id,
    });
    const orderId = (order.id || order.order_id) as number;
    const orderNo = (order.order_no as string) || '';

    // 2. Generate daily queue number (resets at 00:00 WIB) - VERY FAST
    let queueNum: number | undefined;
    try {
      const { getNextQueueNumber } = await import("@/lib/queue-number");
      queueNum = await getNextQueueNumber();
    } catch (qErr) {
      console.warn(`[Queue] Failed to generate queue number:`, qErr);
    }

    // 3. Offload all heavy synchronization steps to the background
    runInBackground(async () => {
      console.log(`[Sync] Starting background synchronization for POS order #${orderId}`);
      
      // 3a. Add each item separately (required by Olsera Open API for Open Orders)
      for (const item of items) {
        if (!item.productId) continue;
        try {
          // Concatenate note and options for Olsera
          let fullNote = item.note || "";
          const optStr = formatOptionsWithToppings(item.options);
          if (optStr) fullNote = fullNote ? `${fullNote} (${optStr})` : optStr;

          await olsera.addItemToOrder(
            orderId,
            parseInt(item.productId),
            item.variantId ? parseInt(item.variantId) : null,
            item.quantity,
            fullNote
          );
        } catch (err) {
          console.error(`Failed to add item ${item.productId} to order ${orderId}:`, err);
        }
      }

      // 3b. Synchronize custom prices and distribute voucher discount in Olsera Open Order
      try {
        const totalOrderAmount = items.reduce((acc, item) => acc + (item.price || 0) * item.quantity, 0);

        // Fetch the generated order detail from Olsera to get the generated orderitem IDs
        // Olsera Open API writes items asynchronously or with slight lag, so we use progressive retries.
        let orderDetail: any = null;
        let olseraItems: any[] = [];
        
        // Load menu items to map category slugs for discount logic
        let menuItems: any[] = [];
        try {
          menuItems = await getMenuItems();
        } catch (mErr) {}
        const catMap = new Map();
        menuItems.forEach((m) => catMap.set(m.name, m.categorySlug));

        for (let attempt = 1; attempt <= 4; attempt++) {
          // Delay: 1.0s, 1.5s, 1.5s, 1.5s
          await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 1000 : 1500));
          
          console.log(`[Sync] Fetching order detail for #${orderId} (Attempt ${attempt}/4)...`);
          orderDetail = await olsera.getOrderDetail(orderId, true); // Force bypass cache!
          
          olseraItems = Array.isArray(orderDetail.orderitems || orderDetail.items)
            ? (orderDetail.orderitems || orderDetail.items)
            : [];
            
          if (olseraItems.length >= items.length) {
            console.log(`[Sync] Olsera items populated successfully: ${olseraItems.length}/${items.length}`);
            break;
          }
          console.warn(`[Sync] Olsera items incomplete: ${olseraItems.length}/${items.length}. Retrying...`);
        }

        if (olseraItems.length === 0) {
          console.error(`[Sync] Skipping item sync because no order items were returned from Olsera for order ${orderId}`);
        } else {
          // Category-aware voucher restriction
          const isRestrictedToNonCoffee = 
            voucherCode?.toUpperCase() === 'RAKKEN002' ||
            (discountAmount > 0 && items.some(item => {
              const categorySlug = catMap.get(item.name || "");
              return categorySlug === 'non-coffee';
            }) && items.some(item => {
              const categorySlug = catMap.get(item.name || "");
              return categorySlug !== 'non-coffee';
            }) && discountAmount < totalOrderAmount * 0.22);

          let eligibleItems = items;
          if (isRestrictedToNonCoffee) {
            eligibleItems = items.filter(item => {
              const categorySlug = catMap.get(item.name || "");
              return categorySlug === 'non-coffee';
            });
          }
          if (eligibleItems.length === 0) {
            eligibleItems = items;
          }

          const eligibleTotalAmount = eligibleItems.reduce((acc, item) => acc + (item.price || 0) * item.quantity, 0);
          let remainingDiscount = discountAmount;

          const calculatedDiscounts = new Map<string, number>();

          for (let idx = 0; idx < eligibleItems.length; idx++) {
            const item = eligibleItems[idx];
            const itemPrice = item.price || 0;
            let itemDiscount = 0;
            
            if (discountAmount > 0 && eligibleTotalAmount > 0) {
              if (idx === eligibleItems.length - 1) {
                itemDiscount = remainingDiscount;
              } else {
                const share = (itemPrice * item.quantity) / eligibleTotalAmount;
                itemDiscount = Math.round(discountAmount * share);
                remainingDiscount -= itemDiscount;
              }
            }
            calculatedDiscounts.set(`${item.productId}-${item.variantId || ''}`, itemDiscount);
          }

          for (let idx = 0; idx < items.length; idx++) {
            const localItem = items[idx];
            const localProductId = String(localItem.productId || '');
            const localVariantId = localItem.variantId ? String(localItem.variantId) : '';

            // Find the matching item added to Olsera using robust string comparison
            const matchingOlseraItem = olseraItems.find((oi: any) => {
              const oiProductId = String(oi.product_id || '');
              const oiVariantId = (oi.product_variant_id || oi.variant_id) ? String(oi.product_variant_id || oi.variant_id) : '';
              return oiProductId === localProductId && oiVariantId === localVariantId;
            });

            if (matchingOlseraItem && matchingOlseraItem.id) {
              const itemPrice = localItem.price || 0;
              const itemDiscount = calculatedDiscounts.get(`${localProductId}-${localVariantId}`) || 0;

              // Concatenate note and options for the item details
              let fullNote = localItem.note || "";
              const optStr = formatOptionsWithToppings(localItem.options);
              if (optStr) fullNote = fullNote ? `${fullNote} (${optStr})` : optStr;

              console.log(`[Sync] Updating Olsera orderitem #${matchingOlseraItem.id} (Product: ${localProductId}) to price: ${itemPrice}, discount: ${itemDiscount}`);
              
              // Push the price and discount details to Olsera
              await olsera.updateOrderItemDetail(
                orderId,
                matchingOlseraItem.id,
                itemPrice,
                itemDiscount,
                localItem.quantity,
                fullNote
              );
            } else {
              console.warn(`[Sync] Could not find matching Olsera item for local product ID: ${localProductId}, variant ID: ${localVariantId}`);
            }
          }
          console.log(`[Sync] Successfully synchronized custom prices and Rp ${discountAmount} discount to Olsera Open Order #${orderId}`);
        }
      } catch (syncErr: any) {
        console.warn(`[Sync] Failed to synchronize prices/discount details to Olsera Open Order:`, syncErr.message);
      }

      // 3c. Mirror to local Prisma for Dashboard/Reporting (Sprint 4)
      try {
        const { prisma } = await import("@/lib/db");

        // Load menu items to accurately map categories
        let menuItems: any[] = [];
        try {
          menuItems = await getMenuItems();
        } catch (mErr) {
          console.warn(`[Sync] Failed to fetch menu items for category mapping:`, mErr);
        }
        const catMap = new Map();
        menuItems.forEach((m) => catMap.set(m.name, m.categorySlug));

        const hasCoffee = items.some((item) => {
          const categorySlug = catMap.get(item.name || "");
          return ["rakken-signature", "rakken-style"].includes(categorySlug);
        });
        const hasFood = items.some((item) => {
          const categorySlug = catMap.get(item.name || "");
          return !["rakken-signature", "rakken-style"].includes(categorySlug);
        });

        const baseTotal = items.reduce(
          (acc, item) => acc + (item.price || 0) * item.quantity,
          0,
        );
        const finalTotal = Math.max(0, baseTotal - discountAmount);

        await prisma.order.create({
          data: {
            id: `OLSERA-${orderId}`,
            stationId: "KIOSK", // Kiosk self-service
            cashierId: "cmo83g6140000vq5g10u03858", // Valid system user for Kiosk sync
            queueNumber: queueNum || null,
            total: finalTotal,
            status: "PENDING",
            baristaStatus: hasCoffee ? "PENDING" : "COMPLETED",
            kitchenStatus: hasFood ? "PENDING" : "COMPLETED",
            items: {
              create: items.map((item) => {
                // Format customization details for local receipt fallback
                let displayNotes = item.note || "";
                const optStr = formatOptionsWithToppings(item.options);
                if (optStr) displayNotes = displayNotes ? `${displayNotes} (${optStr})` : optStr;

                return {
                  olseraId: item.productId,
                  name: item.name || "Item",
                  quantity: item.quantity,
                  price: item.price || 0,
                  subtotal: (item.price || 0) * item.quantity,
                  notes: displayNotes,
                };
              }),
            },
          },
        });
        console.log(`[Sync] Order OLSERA-${orderId} (${orderNo}) Queue=#${String(queueNum).padStart(3, '0')} mirrored.`);

        await logOrderStatusChange({
          orderId: `OLSERA-${orderId}`,
          statusField: "order",
          fromStatus: null,
          toStatus: "PENDING",
          source: "order_created",
          metadata: { olseraOrderId: orderId, orderNo, queueNumber: queueNum },
        });
      } catch (dbErr) {
        console.warn(`[Sync] Failed to mirror order to local database:`, dbErr);
      }
    });

    return {
      orderId: `OLSERA-${orderId}`,
      olseraOrderId: orderId,
      orderNo: orderNo,
      queueNumber: queueNum,
    };
  }
  // Fallback removed
  throw new Error(
    "Local database (Prisma) is no longer supported for creating orders.",
  );
}

/**
 * Update order status after payment
 * For Olsera: runs the full auto-settlement flow
 */
export async function updateOrderPaymentStatus(
  orderId: string,
  status: "paid" | "failed" | "expired",
  paymentAmount?: number,
  source: StatusLogSource = "olsera_settlement",
  extraMetadata?: Record<string, unknown>,
): Promise<void> {
  if (USE_OLSERA && orderId.startsWith("OLSERA-")) {
    const olseraOrderId = parseInt(orderId.replace("OLSERA-", ""));

    if (status === "paid") {
      let paymentModeId: number | undefined = undefined;

      try {
        // Step 1: Get payment methods to find QRIS/Midtrans mode ID
        // (This API randomly returns 500 on Sandbox, so we wrap it)
        const paymentMethods = await olsera.getPaymentMethods();
        const targetNames = [
          "qris",
          "midtrans",
          "e-wallet",
          "ewallet",
          "online",
          "transfer",
        ];
        paymentModeId = paymentMethods[0]?.id;

        for (const method of paymentMethods) {
          const name = String(method.name).toLowerCase();
          if (targetNames.some((t) => name.includes(t))) {
            paymentModeId = method.id;
            break;
          }
        }
      } catch (paymentDetailsError) {
        console.warn(
          `[Auto-Settlement] Non-fatal: Could not fetch payment methods from Olsera. Falling back to default ID 1.`,
        );
        paymentModeId = 1; // Fallback to 1 (usually Cash/Default)
      }

      try {
        // Step 2: Record payment details on the order
        // Fetch the absolute source of truth for the total from Olsera to avoid 406 "Incorrect payment amount"
        const orderDetail = await olsera.getOrderDetail(orderId);
        const actualOlseraTotal = orderDetail.total
          ? parseFloat(String(orderDetail.total))
          : paymentAmount || 0;

        // Already paid in Olsera (e.g. a duplicate webhook/verify race) — skip
        // re-settling payment there, but STILL fall through to broadcast the
        // local status update and create the print job below. Returning early
        // here used to silently skip both, which is how a paid order could
        // end up with no print job at all when two settlement triggers race.
        const alreadyPaidInOlsera =
          orderDetail.is_paid === true ||
          orderDetail.is_paid === 1 ||
          orderDetail.is_paid === "1";
        if (alreadyPaidInOlsera) {
          console.log(
            `[Auto-Settlement] Order ${orderId} already marked as PAID in Olsera. Skipping Olsera settlement, still syncing local state.`,
          );
        }

        if (!alreadyPaidInOlsera && actualOlseraTotal > 0 && paymentModeId) {
          try {
            console.log(
              `[Auto-Settlement] Initializing settlement for Olsera order ${orderId} with amount: ${actualOlseraTotal}`,
            );
            await olsera.updateOrderPayment(
              olseraOrderId,
              actualOlseraTotal,
              paymentModeId,
            );

            // CRITICAL: Also mark as Paid (status=1) so Olsera allows status updates to A/Z later
            await olsera.markOrderAsPaid(olseraOrderId, true);
            console.log(
              `[Auto-Settlement] Successfully recorded payment info for order ${orderId}`,
            );

            // FORCE status back to PENDING (P)
            // Olsera sometimes auto-accepts orders and moves them to 'A' (Preparing).
            // We force it back to 'P' so it appears in the first column of the KDS.
            await olsera.updateOrderStatus(olseraOrderId, "P");
            console.log(
              `[Auto-Settlement] Forced status to PENDING for order ${orderId}`,
            );
          } catch (paymentAppendError: any) {
            console.warn(
              `[Auto-Settlement] Non-fatal: Could not append payment details to Olsera order ${orderId}:`,
              paymentAppendError.message,
            );
          }
        }

        // Step 3: Broadcast to KDS via Pusher
        // The Barista will manually move it to PREPARING (A) by clicking "Start Making"
        console.log(
          `[Auto-Settlement] ✅ Order ${orderId} marked as PAID. Broadcasting to KDS...`,
        );

        try {
          const { pusherServer } = await import("@/lib/pusher");
          await pusherServer.trigger("kitchen", "ORDER_CREATED", {
            order: {
              id: orderId,
              queueNumber: olseraOrderId % 1000,
              status: "PENDING",
              totalAmount: orderDetail.total || paymentAmount || 0,
              paymentMethod: "MIDTRANS",
              createdAt: orderDetail.order_date || new Date().toISOString(),
              items: Array.isArray(orderDetail.items)
                ? orderDetail.items.map((item: any, idx: number) => ({
                    id: idx,
                    menuItem: {
                      name: item.product_name || item.name || "Item",
                    },
                    quantity: item.qty || item.quantity || 1,
                    size: item.variant_name || "-",
                  }))
                : [],
            },
          });
          console.log(`[Pusher] ORDER_CREATED broadcast for ${orderId}`);
        } catch (pusherErr) {
          console.warn(
            "[Pusher] Failed to broadcast ORDER_CREATED:",
            pusherErr,
          );
        }

        // Step 4: Broadcast to Admin Reports (Sprint 4)
        try {
          const { pusherServer } = await import("@/lib/pusher");
          await pusherServer.trigger("admin-reports", "SALES_UPDATED", {
            orderId,
            amount: actualOlseraTotal,
          });
          console.log(`[Pusher] SALES_UPDATED broadcast for ${orderId}`);
        } catch (adminPusherErr) {
          console.warn(
            "[Pusher] Failed to broadcast SALES_UPDATED:",
            adminPusherErr,
          );
        }

        // Step 5: Update local Prisma status (Sprint 4)
        try {
          const { prisma } = await import("@/lib/db");

          // The local mirror row is written by a separate background task (see
          // createOrder's runInBackground) that can still be in flight here —
          // retry briefly instead of failing outright when the row isn't there yet.
          let updated = false;
          let previousStatus: string | null = null;
          const MAX_ATTEMPTS = 8;
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
              const before = await prisma.order.findUnique({
                where: { id: orderId },
                select: { status: true },
              });
              previousStatus = before?.status ?? null;
              await prisma.order.update({
                where: { id: orderId },
                data: { status: "PAID" },
              });
              updated = true;
              break;
            } catch (updateErr: any) {
              if (updateErr?.code !== "P2025" || attempt === MAX_ATTEMPTS) throw updateErr;
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
          if (!updated) throw new Error(`Local order ${orderId} row never appeared`);
          console.log(`[Sync] Local order ${orderId} updated to PAID.`);

          await logOrderStatusChange({
            orderId,
            statusField: "order",
            fromStatus: previousStatus,
            toStatus: "PAID",
            source,
            metadata: { paymentAmount, olseraOrderId, ...extraMetadata },
          });

          // Step 6: Create Print Job in the Cloud Print Queue automatically
          try {
            const localOrderFull = await prisma.order.findUnique({
              where: { id: orderId },
              include: { items: true }
            });

            // Prevent duplicate print jobs
            const existingJob = await prisma.printJob.findFirst({
              where: {
                orderId: orderId,
                status: { in: ['PENDING', 'PRINTING', 'PRINTED'] }
              }
            });

            if (!existingJob) {
              const displayOrderNo = localOrderFull?.olseraTransactionId 
                ? `OLSERA-${localOrderFull.olseraTransactionId}` 
                : orderId;

              const qNum = localOrderFull?.queueNumber 
                ? String(localOrderFull.queueNumber) 
                : (() => {
                    const numericId = orderId.replace('OLSERA-', '').replace(/OFFLINE-/, '').replace(/[^0-9]/g, '');
                    return numericId.length > 3 ? numericId.slice(-3) : numericId;
                  })();

              // Fetch menu items for category mapping
              let menuItems: any[] = [];
              try {
                menuItems = await getMenuItems();
              } catch (mErr) {}
              const catMap = new Map();
              menuItems.forEach(m => catMap.set(m.name, m.categorySlug));

              const itemsPayload = localOrderFull?.items.map((item, idx) => {
                let displaySize = '-';
                const sizeMatch = item.notes?.match(/Size:\s*([^,)]+)/i);
                if (sizeMatch) displaySize = sizeMatch[1];

                return {
                  id: idx,
                  menuItem: { name: item.name },
                  quantity: item.quantity,
                  price: item.price,
                  notes: item.notes || '',
                  size: displaySize,
                  categorySlug: catMap.get(item.name) || 'other',
                };
              }) || [];

              const itemsSum = itemsPayload.reduce((acc, item) => acc + (item.price * item.quantity), 0);
              // Local Prisma total is authoritative (set at order creation from the actual
              // discount) — `||` would wrongly fall back to actualOlseraTotal for legitimate
              // Rp 0 orders since 0 is falsy.
              const finalTotal = localOrderFull?.total ?? actualOlseraTotal;
              const calculatedDiscount = Math.max(0, itemsSum - finalTotal);

              const printPayload = {
                orderId: displayOrderNo,
                queueNumber: qNum,
                customerName: orderDetail?.customer_name || 'Customer',
                items: itemsPayload,
                total: finalTotal,
                discount: calculatedDiscount,
                paymentMethod: localOrderFull?.paymentMethod || 'E-Wallet',
              };

              const createdJob = await prisma.printJob.create({
                data: {
                  orderId: orderId,
                  payload: printPayload,
                  status: 'PENDING',
                }
              });
              console.log(`[Auto-Settlement] Cloud Print Job created for ${orderId} with ${itemsPayload.length} items.`);

              // Nudge the print-bridge daemon instead of making it wait for
              // its next poll tick.
              try {
                const { pusherServer } = await import("@/lib/pusher");
                await pusherServer.trigger('print-queue', 'NEW_JOB', { jobId: createdJob.id });
              } catch (printPusherErr) {
                console.warn('[Auto-Settlement] Failed to broadcast NEW_JOB (non-blocking):', printPusherErr);
              }
            }
          } catch (printJobErr) {
            console.warn(`[Auto-Settlement] Failed to automatically create cloud print job:`, printJobErr);
          }
        } catch (dbUpdateErr) {
          console.warn(
            `[Sync] Failed to update local order status:`,
            dbUpdateErr,
          );
        }
      } catch (error: any) {
        // Log but don't throw — webhook must still return 200 to Midtrans
        console.error(
          `[Auto-Settlement] ❌ Failed to settle order ${orderId} in Olsera:`,
          error.message,
        );
      }
    } else {
      console.log(
        `[Olsera POS] Order ${orderId} status: ${status}. Marking local order as CANCELLED.`,
      );
      try {
        const { prisma } = await import("@/lib/db");
        const before = await prisma.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });
        if (before && before.status !== "CANCELLED" && before.status !== "PAID") {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: "CANCELLED" },
          });
          await logOrderStatusChange({
            orderId,
            statusField: "order",
            fromStatus: before.status,
            toStatus: "CANCELLED",
            source,
            metadata: { midtransStatus: status, ...extraMetadata },
          });
        }
      } catch (cancelErr) {
        console.warn(
          `[Auto-Settlement] Failed to mark order ${orderId} as CANCELLED (non-blocking):`,
          cancelErr,
        );
      }
    }
    return;
  }
  // ═══════════════════════════════════════════════════════════════
  // SYNC RECOVERY: Order SF- (Fallback) yang sudah dibayar
  // ═══════════════════════════════════════════════════════════════
  // Skenario: Saat checkout, Olsera API gagal → ID jadi SF-xxxx.
  // Pelanggan tetap bayar via Midtrans → webhook masuk dengan SF-xxxx.
  // Kita HARUS recover order ini ke Olsera agar tidak hilang.
  if (USE_OLSERA && orderId.startsWith("SF-") && status === "paid") {
    console.log(`[Recovery] ⚠️ Order fallback terdeteksi: ${orderId}`);
    console.log(
      `[Recovery] Attempting to create order in Olsera for reconciliation...`,
    );

    let recoveredOlseraId: string | null = null;

    try {
      // Step 1: Buat order baru di Olsera (tanpa item — hanya header)
      // Item tidak bisa di-recovery karena data cart sudah hilang dari konteks webhook.
      // Tapi order tetap tercatat di Olsera untuk keperluan audit/reconciliation.
      const newOrder = await olsera.createOrder([], {
        customer_name: `Recovery ${orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}`,
      });
      const newOlseraId = (newOrder.id || newOrder.order_id) as number;
      recoveredOlseraId = `OLSERA-${newOlseraId}`;
      console.log(
        `[Recovery] ✅ Order created in Olsera: ${recoveredOlseraId}`,
      );

      // Step 2: Settlement di Olsera (mark as paid)
      try {
        let paymentModeId = 1;
        try {
          const paymentMethods = await olsera.getPaymentMethods();
          const targetNames = [
            "qris",
            "midtrans",
            "e-wallet",
            "ewallet",
            "online",
            "transfer",
          ];
          for (const method of paymentMethods) {
            if (
              targetNames.some((t) =>
                String(method.name).toLowerCase().includes(t),
              )
            ) {
              paymentModeId = method.id;
              break;
            }
          }
        } catch {
          /* use default */
        }

        if (paymentAmount && paymentAmount > 0) {
          await olsera.updateOrderPayment(
            newOlseraId,
            paymentAmount,
            paymentModeId,
          );
          await olsera.markOrderAsPaid(newOlseraId, true);
          await olsera.updateOrderStatus(newOlseraId, "P");
          console.log(
            `[Recovery] ✅ Settlement completed for ${recoveredOlseraId}`,
          );
        }
      } catch (settlementErr: any) {
        console.warn(
          `[Recovery] Settlement partially failed (non-blocking): ${settlementErr.message}`,
        );
      }
    } catch (recoveryErr: any) {
      console.warn(
        `[Recovery] ⚠️ Could not create Olsera order (non-blocking): ${recoveryErr.message}`,
      );
      // Even if Olsera fails again, we still broadcast to KDS and update local DB
    }

    // Step 3: Broadcast ke KDS via Pusher — pelanggan sudah bayar, barista HARUS tahu
    try {
      const { pusherServer } = await import("@/lib/pusher");
      await pusherServer.trigger("kitchen", "ORDER_CREATED", {
        order: {
          id: recoveredOlseraId || orderId,
          queueNumber: Math.floor(Math.random() * 900) + 100,
          status: "PENDING",
          totalAmount: paymentAmount || 0,
          paymentMethod: "MIDTRANS",
          createdAt: new Date().toISOString(),
          items: [], // Items tidak tersedia dari webhook context
          isRecovered: true, // Flag agar KDS tahu ini order recovery
        },
      });
      console.log(
        `[Recovery] ✅ KDS broadcast sent for ${recoveredOlseraId || orderId}`,
      );
    } catch (pusherErr) {
      console.warn(
        "[Recovery] Pusher broadcast failed (non-blocking):",
        pusherErr,
      );
    }

    // Step 4: Update database lokal
    try {
      const { prisma } = await import("@/lib/db");
      // Coba update jika sudah ada
      const existing = await prisma.order.findUnique({
        where: { id: orderId },
      });
      if (existing) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: "PAID",
            olseraSynced: recoveredOlseraId !== null,
            olseraTransactionId: recoveredOlseraId || undefined,
          },
        });
        console.log(`[Recovery] ✅ Local DB updated for ${orderId}`);
        await logOrderStatusChange({
          orderId,
          statusField: "order",
          fromStatus: existing.status,
          toStatus: "PAID",
          source: "system_recovery",
          metadata: { recoveredOlseraId, originalOrderId: orderId },
        });
      } else {
        // Buat record baru jika belum ada (checkout awal gagal total)
        await prisma.order.create({
          data: {
            id: recoveredOlseraId || orderId,
            stationId: "KIOSK",
            cashierId: "cmo83g6140000vq5g10u03858",
            total: paymentAmount || 0,
            status: "PAID",
            paymentMethod: "MIDTRANS",
            olseraSynced: recoveredOlseraId !== null,
            olseraTransactionId: recoveredOlseraId || undefined,
            items: { create: [] },
          },
        });
        console.log(
          `[Recovery] ✅ New local DB record created for ${recoveredOlseraId || orderId}`,
        );
        await logOrderStatusChange({
          orderId: recoveredOlseraId || orderId,
          statusField: "order",
          fromStatus: null,
          toStatus: "PAID",
          source: "system_recovery",
          metadata: { recoveredOlseraId, originalOrderId: orderId },
        });
      }
    } catch (dbErr: any) {
      console.warn(
        `[Recovery] DB update failed (non-blocking): ${dbErr.message}`,
      );
    }

    console.log(
      `[Recovery] 🏁 Reconciliation complete for ${orderId} → ${recoveredOlseraId || "(local only)"}`,
    );
    return;
  }

  // Non-SF, Non-OLSERA orders — truly unsupported
  console.warn(
    `[Auto-Settlement] Order ${orderId} is not recognized. No action taken.`,
  );
  return;
}

/**
 * Apply a discount to an Olsera order (best-effort)
 * Note: Olsera Open API may not support native discount injection.
 * We log it here so it's tracked, and the actual discount is reflected in Midtrans payment amount.
 */
export async function applyOrderDiscount(
  orderId: string,
  discountAmount: number,
): Promise<void> {
  if (!USE_OLSERA) return;
  // Olsera Open API doesn't have a dedicated discount endpoint.
  // The discount is already reflected in the Midtrans payment amount.
  console.log(
    `[POS Adapter] Discount of Rp ${discountAmount.toLocaleString("id-ID")} applied to order ${orderId} (tracked in Midtrans, not synced to Olsera).`,
  );
}

/**
 * Check if Olsera integration is active
 */
export function isOlseraEnabled(): boolean {
  return USE_OLSERA;
}
