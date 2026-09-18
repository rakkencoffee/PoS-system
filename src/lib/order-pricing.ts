import { getMenuItems, type NormalizedMenuItem } from "@/lib/integrations/pos.adapter";
import { BAG_OPTIONS } from "@/lib/bag-options";
import { olseraApi } from "@/lib/integrations/olsera.service";

/**
 * Server-side pricing verification for checkout.
 *
 * The kiosk computes each item's price client-side (base + variant + add-on
 * surcharges, see CustomizeModal.tsx) and previously sent that price straight
 * through to /api/payment/create, which trusted it completely -- anyone could
 * edit the request and pay less than the real price while the full amount
 * still got charged... to the wrong thing, or the wrong amount got pushed to
 * the physical EDC terminal. This recomputes every item's price from the same
 * Olsera catalog the kiosk itself reads from, so the amount that reaches the
 * EDC/Olsera is always derived server-side, never trusted from the client.
 */

// Only recognizes add-on toppings CustomizeModal.tsx currently produces
// (`milk-addon-<id>`, `beans-addon-<id>`, `shot-addon-<id>`). Older topping
// id formats (numeric 9001-9005, "milk-skim", etc.) are legacy display-only
// leftovers from a previous scheme -- nothing in the current kiosk UI
// generates them anymore, so they're treated as free/no-op here rather than
// guessed at.
const ADDON_TOPPING_RE = /^(?:milk|beans|shot)-addon-(\d+)$/;

export interface PriceableItem {
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  name?: string;
  options?: { toppings?: (string | number)[] };
}

export interface VerifiedItem {
  productId: string;
  name: string;
  categorySlug: string;
  quantity: number;
  unitPrice: number;
  isBag: boolean;
}

export type VerifyItemsResult =
  | { ok: true; items: VerifiedItem[]; subtotal: number }
  | { ok: false; error: string };

function findBagOption(productId: string) {
  return BAG_OPTIONS.find((b) => String(b.olseraProductId) === String(productId));
}

function computeExpectedUnitPrice(
  item: PriceableItem,
  catalog: NormalizedMenuItem[],
): { ok: true; price: number; name: string; categorySlug: string } | { ok: false; error: string } {
  const bagOption = findBagOption(item.productId);
  if (bagOption) {
    return { ok: true, price: bagOption.price, name: bagOption.label, categorySlug: "packaging" };
  }

  const menuItem = catalog.find(
    (m) => m.id === String(item.productId) || String(m.olseraProductId) === String(item.productId),
  );
  if (!menuItem) {
    return { ok: false, error: `Produk tidak dikenali (${item.productId}). Silakan refresh menu dan coba lagi.` };
  }

  let basePrice = menuItem.price;
  if (item.variantId) {
    const variant = menuItem.olseraVariants?.find((v) => String(v.id) === String(item.variantId));
    if (!variant) {
      return { ok: false, error: `Varian tidak dikenali untuk ${menuItem.name}. Silakan refresh menu dan coba lagi.` };
    }
    basePrice = variant.price;
  }

  let addonTotal = 0;
  for (const toppingId of item.options?.toppings || []) {
    const match = ADDON_TOPPING_RE.exec(String(toppingId));
    if (!match) continue;
    const addonId = Number(match[1]);
    const addon = menuItem.addOns?.find((a) => Number(a.id) === addonId);
    if (!addon) {
      return { ok: false, error: `Add-on tidak dikenali untuk ${menuItem.name}. Silakan refresh menu dan coba lagi.` };
    }
    addonTotal += addon.price;
  }

  return { ok: true, price: basePrice + addonTotal, name: menuItem.name, categorySlug: menuItem.categorySlug };
}

/**
 * Recomputes every item's unit price from the Olsera catalog and rejects the
 * whole order if any submitted price doesn't match -- callers should treat
 * `items` as the only trustworthy price data from this point on.
 */
export async function verifyOrderItems(items: PriceableItem[]): Promise<VerifyItemsResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Order tidak boleh kosong." };
  }

  const catalog = await getMenuItems({ includeUnavailable: true });
  const verified: VerifiedItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: "Kuantitas item tidak valid." };
    }

    const result = computeExpectedUnitPrice(item, catalog);
    if (!result.ok) return result;

    const submittedUnit = Number(item.price);
    if (!Number.isFinite(submittedUnit) || Math.round(submittedUnit) !== Math.round(result.price)) {
      return {
        ok: false,
        error: `Harga untuk "${result.name}" tidak sesuai menu terbaru. Silakan refresh menu dan coba lagi.`,
      };
    }

    verified.push({
      productId: String(item.productId),
      name: result.name,
      categorySlug: result.categorySlug,
      quantity: qty,
      unitPrice: result.price,
      isBag: !!findBagOption(item.productId),
    });
    subtotal += result.price * qty;
  }

  return { ok: true, items: verified, subtotal };
}

// ──────────────────────────────
// Voucher discount — same logic /api/payment/validate-voucher exposes to the
// kiosk for its "Apply" preview, reused here so /api/payment/create never
// has to trust the discountAmount a client says that preview returned.
// ──────────────────────────────

function isNonCoffeeItem(category: string, name: string): boolean {
  const cat = String(category || "").toLowerCase().trim();
  const itemName = String(name || "").toLowerCase().trim();
  return (
    cat === "non-coffee" ||
    cat === "non coffee" ||
    cat === "milk-based" ||
    cat === "refreshment" ||
    itemName.includes("tea") ||
    itemName.includes("milk") ||
    itemName.includes("matcha") ||
    (itemName.includes("latte") && !itemName.includes("coffee") && !itemName.includes("espresso"))
  );
}

export interface DiscountableItem {
  id: string | number;
  category: string;
  name: string;
  price: number;
  quantity: number;
}

export type VoucherDiscountResult =
  | { ok: true; message: string; discountAmount: number; itemDiscounts: Record<string, number> }
  | { ok: false; error: string };

export async function computeVoucherDiscount(
  code: string,
  totalAmount: number,
  items?: DiscountableItem[],
): Promise<VoucherDiscountResult> {
  const uppercaseCode = code.toUpperCase().trim();
  const result = await olseraApi.validateVoucherRemote(uppercaseCode, totalAmount);
  if (!result.valid) {
    return { ok: false, error: result.message };
  }

  const voucher = await olseraApi.getVoucherByCode(uppercaseCode);
  if (!voucher) {
    return { ok: false, error: "Kode voucher tidak ditemukan." };
  }

  const discountRate = parseFloat(voucher.discount_rate || "0");
  const discountNominal = parseFloat(voucher.discount_amount || "0");
  const isPercentage = voucher.discount_with === 2;

  let finalDiscountAmount = result.discountAmount;
  const itemDiscounts: Record<string, number> = {};

  if (Array.isArray(items) && items.length > 0) {
    const isRestrictedToNonCoffee =
      uppercaseCode === "RAKKEN002" ||
      String(voucher.title || "").toLowerCase().includes("non-coffee") ||
      String(voucher.title || "").toLowerCase().includes("non coffee");

    const eligibleItems = items.filter((item) =>
      isRestrictedToNonCoffee ? isNonCoffeeItem(item.category, item.name) : true,
    );

    const eligibleTotal = eligibleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (eligibleItems.length > 0) {
      if (isPercentage) {
        eligibleItems.forEach((item) => {
          const itemSubtotal = item.price * item.quantity;
          itemDiscounts[item.id] = Math.floor(itemSubtotal * discountRate);
        });
        finalDiscountAmount = Object.values(itemDiscounts).reduce((sum, d) => sum + d, 0);
      } else {
        let remainingDiscount = Math.min(discountNominal, eligibleTotal);
        eligibleItems.forEach((item, idx) => {
          const itemSubtotal = item.price * item.quantity;
          let itemDiscount = 0;
          if (idx === eligibleItems.length - 1) {
            itemDiscount = remainingDiscount;
          } else {
            const share = itemSubtotal / eligibleTotal;
            itemDiscount = Math.round(Math.min(discountNominal, eligibleTotal) * share);
            remainingDiscount -= itemDiscount;
          }
          itemDiscounts[item.id] = itemDiscount;
        });
        finalDiscountAmount = Object.values(itemDiscounts).reduce((sum, d) => sum + d, 0);
      }
    } else {
      if (isRestrictedToNonCoffee) {
        return { ok: false, error: "Voucher ini hanya berlaku untuk kategori Non-Coffee saja." };
      }
      finalDiscountAmount = 0;
    }
  }

  return { ok: true, message: result.message, discountAmount: finalDiscountAmount, itemDiscounts };
}
