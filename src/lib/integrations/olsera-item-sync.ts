/**
 * Pasangkan baris keranjang lokal ke baris order Olsera, lalu hitung
 * update (harga, diskon, qty, catatan) per baris Olsera. Murni (tanpa
 * fetch) biar bisa dites: node scripts/check-olsera-item-sync.mjs
 *
 * Dulu dicocokkan pakai key "produk-varian" + olseraItems.find(), jadi 2
 * baris dengan produk+varian sama (mis. 2 Cafe Latte Ice Small beda gula)
 * saling timpa: diskon baris pertama hilang dan baris Olsera kedua nggak
 * pernah di-update.
 */
export interface LocalLine {
  productId?: string | number | null;
  variantId?: string | number | null;
  price: number; // harga per unit (sudah termasuk add-on)
  quantity: number;
  discount: number; // total diskon baris ini
  note: string;
}

export interface OlseraItemUpdate {
  rowId: number | string;
  price: number;
  discount: number;
  qty: number;
  note: string;
}

const variantOf = (oi: any) => oi.product_variant_id || oi.variant_id;

export function planOlseraItemUpdates(lines: LocalLine[], olseraItems: any[]) {
  const used = new Set<string>();
  const groups = new Map<string, { rowId: number | string; lines: LocalLine[] }>();
  const unmatched: LocalLine[] = [];

  for (const line of lines) {
    const pid = String(line.productId || "");
    const vid = line.variantId ? String(line.variantId) : "";
    const matches = olseraItems.filter(
      (oi) => oi?.id && String(oi.product_id || "") === pid && (variantOf(oi) ? String(variantOf(oi)) : "") === vid,
    );
    // Utamakan baris yang belum dipakai (Olsera bikin 1 baris per additem).
    // Kalau semua sudah dipakai, berarti Olsera menggabungkan baris yang sama.
    const row = matches.find((oi) => !used.has(String(oi.id))) || matches[0];
    if (!row) {
      unmatched.push(line);
      continue;
    }
    used.add(String(row.id));
    const g = groups.get(String(row.id)) || { rowId: row.id, lines: [] as LocalLine[] };
    g.lines.push(line);
    groups.set(String(row.id), g);
  }

  const updates: OlseraItemUpdate[] = [...groups.values()].map(({ rowId, lines: ls }) => {
    const qty = ls.reduce((s, l) => s + l.quantity, 0);
    const gross = ls.reduce((s, l) => s + l.price * l.quantity, 0);
    // Baris gabungan cuma punya 1 harga satuan: bulatkan ke atas, selisihnya
    // masuk diskon biar total tetap persis sama dengan yang ditagih.
    const price = ls.length === 1 ? ls[0].price : Math.ceil(gross / qty);
    const discount = ls.reduce((s, l) => s + l.discount, 0) + (price * qty - gross);
    const note = ls.map((l) => l.note).filter(Boolean).join(" | ");
    return { rowId, price, discount, qty, note };
  });

  return { updates, unmatched };
}
