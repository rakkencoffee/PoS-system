// Self-check pencocokan baris keranjang -> baris Olsera.
// Jalankan: node scripts/check-olsera-item-sync.mjs
import assert from "node:assert/strict";
import { planOlseraItemUpdates as plan } from "../src/lib/integrations/olsera-item-sync.ts";

const line = (o) => ({ productId: "10", variantId: "77", price: 30000, quantity: 1, discount: 0, note: "", ...o });
const row = (id, product_id = 10, product_variant_id = 77) => ({ id, product_id, product_variant_id });

// Olsera bikin baris terpisah: tiap baris lokal dapat baris Olsera sendiri,
// diskon baris pertama nggak ketimpa baris kedua.
let r = plan(
  [line({ discount: 20000, note: "Less Sugar" }), line({ note: "Normal Sugar" })],
  [row(1), row(2)],
);
assert.deepEqual(r.updates, [
  { rowId: 1, price: 30000, discount: 20000, qty: 1, note: "Less Sugar" },
  { rowId: 2, price: 30000, discount: 0, qty: 1, note: "Normal Sugar" },
]);
assert.equal(r.unmatched.length, 0);

// Olsera menggabungkan jadi 1 baris: qty & diskon dijumlah, 1 update.
r = plan([line({ discount: 20000, note: "A" }), line({ note: "B" })], [row(1)]);
assert.deepEqual(r.updates, [{ rowId: 1, price: 30000, discount: 20000, qty: 2, note: "A | B" }]);

// Gabungan dengan harga satuan beda (add-on): total tetap persis.
r = plan([line({ price: 30000 }), line({ price: 35001 })], [row(1)]);
const u = r.updates[0];
assert.equal(u.price * u.qty - u.discount, 65001);

// Produk beda & tanpa varian tetap cocok normal; yang nggak ketemu dilaporkan.
r = plan(
  [line({ productId: "5", variantId: null, price: 62000 }), line({ productId: "9" })],
  [{ id: 3, product_id: 5 }],
);
assert.deepEqual(r.updates, [{ rowId: 3, price: 62000, discount: 0, qty: 1, note: "" }]);
assert.equal(r.unmatched.length, 1);

console.log("OK: semua cek sinkron item Olsera lolos");
