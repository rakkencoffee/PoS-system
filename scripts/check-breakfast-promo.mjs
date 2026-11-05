// Self-check rumus promo Breakfast. Jalankan: node scripts/check-breakfast-promo.mjs
// (Node 22.6+ bisa import .ts langsung karena promo-categories.ts tanpa import.)
import assert from "node:assert/strict";
import {
  computeBreakfastDiscounts as calc,
  isBreakfastPromoActive as active,
  breakfastPromoRemainingMs as remaining,
} from "../src/lib/promo-categories.ts";

// Harga asli katalog Olsera 2026-11-05.
const bowl = (q = 1) => ({ name: "Teriyaki Bowl", variantName: "Chicken", basePrice: 62000, quantity: q });
const latte = (q = 1) => ({ name: "Cafe Latte", variantName: "Ice,Small", basePrice: 30000, quantity: q });
const lb = (q = 1) => ({ name: "Long Black", variantName: "Ice,Small", basePrice: 28000, quantity: q });

assert.deepEqual(calc([bowl(), latte()]), [0, 20000]); // kopi jadi 10rb
assert.deepEqual(calc([latte()]), [0]); // tanpa bowl, nggak ada diskon
assert.deepEqual(calc([bowl(), { ...latte(), variantName: "Hot,Small", basePrice: 28000 }]), [0, 0]); // hot nggak ikut
assert.deepEqual(calc([bowl(), { ...latte(), variantName: "Ice,Big", basePrice: 36000 }]), [0, 0]); // big nggak ikut
assert.deepEqual(calc([bowl(), { name: "Kokuto Matcha Latte", variantName: "Ice,Small", basePrice: 38000, quantity: 1 }]), [0, 0]); // nama mirip nggak ikut
assert.deepEqual(calc([bowl(), latte(2)]), [0, 20000]); // maks 1 kopi per transaksi
assert.deepEqual(calc([bowl(2), latte(2)]), [0, 20000]); // bukan kelipatan bowl
assert.deepEqual(calc([bowl(), lb(), latte()]), [0, 0, 20000]); // termahal didiskon duluan
assert.deepEqual(calc([bowl(2), lb(), latte()]), [0, 0, 20000]);
assert.deepEqual(calc([{ ...latte(), variantName: "Ice,Small,Bold & Nutty" }, bowl()]), [20000, 0]); // suffix bean tetap kena
const capp = (variantName, basePrice) => ({ name: "Cappuccino", variantName, basePrice, quantity: 1 });
assert.deepEqual(calc([bowl(), capp("Hot,Small", 28000)]), [0, 18000]); // Cappuccino promo-nya Hot Small
assert.deepEqual(calc([bowl(), capp("Hot,Big", 34000)]), [0, 0]);
assert.deepEqual(calc([bowl(), { ...latte(), variantName: "Hot,Small", basePrice: 28000 }]), [0, 0]); // Hot Small cuma buat Cappuccino

// Jam WIB: 09.00 masuk, 10.59 masuk, 11.00 tutup, 08.59 belum; lewat 30 Nov mati.
assert.equal(active(new Date("2026-11-10T09:00:00+07:00")), true);
assert.equal(active(new Date("2026-11-10T10:59:59+07:00")), true);
assert.equal(active(new Date("2026-11-10T11:00:00+07:00")), false);
assert.equal(active(new Date("2026-11-10T08:59:59+07:00")), false);
assert.equal(active(new Date("2026-11-30T10:00:00+07:00")), true);
assert.equal(active(new Date("2026-12-01T10:00:00+07:00")), false);

// Hitungan mundur: jam 10.00 sisa 1 jam, jam 10.59.30 sisa 30 detik, di luar jam 0.
assert.equal(remaining(new Date("2026-11-10T10:00:00+07:00")), 3_600_000);
assert.equal(remaining(new Date("2026-11-10T10:59:30+07:00")), 30_000);
assert.equal(remaining(new Date("2026-11-10T11:30:00+07:00")), 0);

console.log("OK: semua cek promo Breakfast lolos");
