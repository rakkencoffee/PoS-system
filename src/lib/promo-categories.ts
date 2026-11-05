/**
 * Promo Breakfast: beli rice bowl, kopi pilihan (varian tertentu) jadi Rp10.000.
 * Tiap hari 09.00-11.00 WIB sampai 30 Nov 2026.
 *
 * Fungsi di sini murni (tanpa DB/fetch) supaya dipakai bareng oleh
 * order-pricing.ts (server, sumber kebenaran harga) dan halaman cart/checkout
 * kiosk (preview) -- satu rumus, jadi preview nggak bisa beda sama yang
 * ditagih. Ganti jam/tanggal/harga/menu cukup di BREAKFAST_PROMO.
 */
export const BREAKFAST_PROMO = {
  lastDayWib: "2026-11-30", // inklusif
  startHourWib: 9, // 09.00
  endHourWib: 11, // sampai 10.59, jam 11.00 sudah tutup
  coffeePrice: 10_000,
  // Maks kopi promo per transaksi, berapa pun jumlah bowl-nya. Mau kopi promo
  // lagi = transaksi baru.
  maxCoffeePerTransaction: 1,
  // Nama menu persis di Olsera -> varian yang dapat harga promo ("suhu,ukuran").
  // Huruf besar/kecil diabaikan. Nama exact match, bukan "includes" -- biar
  // "Kokuto Matcha Latte" nggak ikut kena. Cappuccino Hot Small karena di
  // Olsera Cappuccino nggak punya varian Ice.
  coffees: {
    "kokuto latte": "ice,small",
    "cafe latte": "ice,small",
    "long black": "ice,small",
    "cappuccino": "hot,small",
  } as Record<string, string>,
};

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // WIB = UTC+7, tanpa DST

export function isBreakfastPromoActive(now: Date = new Date()): boolean {
  // Geser ke WIB lalu baca pakai getter UTC, jadi hasilnya sama di server
  // Vercel (UTC) maupun di laptop lokal (WIB).
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const day = wib.toISOString().slice(0, 10);
  const hour = wib.getUTCHours();
  return day <= BREAKFAST_PROMO.lastDayWib && hour >= BREAKFAST_PROMO.startHourWib && hour < BREAKFAST_PROMO.endHourWib;
}

// Sisa waktu promo hari ini (ms), 0 kalau lagi nggak aktif. Buat hitungan
// mundur di kiosk -- dihitung di server biar nggak ikut jam tablet.
export function breakfastPromoRemainingMs(now: Date = new Date()): number {
  if (!isBreakfastPromoActive(now)) return 0;
  const msSinceMidnightWib = (now.getTime() + WIB_OFFSET_MS) % 86_400_000;
  return BREAKFAST_PROMO.endHourWib * 3_600_000 - msSinceMidnightWib;
}

export const isBreakfastBowl = (name: string) => /bowl/i.test(String(name || ""));

const coffeeKey = (name: string) => String(name || "").toLowerCase().trim();

// Apakah varian ini varian promo untuk kopi tsb. Varian Olsera bentuknya
// "Ice,Small" (kadang ada suffix bean: "Ice,Small,Bold & Nutty"), jadi cukup
// cocokkan 2 segmen pertama.
export function isBreakfastPromoVariant(name: string, variantName: string | undefined): boolean {
  const target = BREAKFAST_PROMO.coffees[coffeeKey(name)];
  if (!target) return false;
  const [temp, size] = String(variantName || "").toLowerCase().split(",").map((s) => s.trim());
  return `${temp},${size}` === target;
}

export interface BreakfastLine {
  name: string;
  variantName?: string;
  basePrice: number; // harga varian per unit, TANPA add-on
  quantity: number;
}

/**
 * Diskon per baris (index sama dengan `lines`). Asal ada minimal 1 bowl,
 * maks `maxCoffeePerTransaction` kopi yang didiskon (bukan kelipatan bowl).
 * Kalau kopi promonya lebih dari itu, yang termahal didiskon duluan.
 * Diskon = harga varian - 10.000, jadi add-on (kalau ada) tetap bayar normal.
 * Cek jam TIDAK di sini -- pemanggil yang cek isBreakfastPromoActive.
 */
export function computeBreakfastDiscounts(lines: BreakfastLine[]): number[] {
  const discounts = lines.map(() => 0);
  const hasBowl = lines.some((l) => isBreakfastBowl(l.name) && l.quantity > 0);
  if (!hasBowl) return discounts;
  let slots = BREAKFAST_PROMO.maxCoffeePerTransaction;

  const eligible = lines
    .map((line, idx) => ({ line, idx }))
    .filter(({ line }) =>
      isBreakfastPromoVariant(line.name, line.variantName) &&
      line.basePrice > BREAKFAST_PROMO.coffeePrice,
    )
    .sort((a, b) => b.line.basePrice - a.line.basePrice);

  for (const { line, idx } of eligible) {
    if (slots <= 0) break;
    const units = Math.min(slots, line.quantity);
    discounts[idx] = units * (line.basePrice - BREAKFAST_PROMO.coffeePrice);
    slots -= units;
  }
  return discounts;
}

// Which categories are food (Kitchen station), as a keyword match against
// categorySlug -- everything NOT matched here defaults to Barista/drink.
// This is deliberately opt-out-of-Kitchen rather than opt-in-to-Barista: an
// unrecognized or newly-added category (a naming drift, a new menu group)
// should default to Barista, not silently vanish from both stations.
// Single source of truth for both the on-screen KDS Kitchen/Barista split
// (KdsView.tsx, api/orders/route.ts, api/orders/[id]/route.ts,
// pos.adapter.ts's hasCoffee/hasFood) and the physical label print split
// (lib/print/format-receipt.ts's isDrinkItem) -- confirmed live 2026-09-24
// that the on-screen split had drifted to a narrower (wrong) list than the
// print side, routing Refreshment/Non-Coffee orders to Kitchen's board
// instead of Barista's. Packaging (bags, cup carriers) is deliberately NOT
// here: it goes to Barista's board and prints on Barista's label printer,
// one label per unit (since 2026-10-11; before that it had no label).
export const KITCHEN_CATEGORY_KEYWORDS = [
  "bites",
  "dessert",
  "main-course",
  "snack",
  "pastry",
  "makanan",
  "cemilan",
  "other",
];

export function isKitchenCategory(categorySlug: string | undefined | null): boolean {
  const slug = (categorySlug || "").toLowerCase();
  return KITCHEN_CATEGORY_KEYWORDS.some((keyword) => slug.includes(keyword));
}
