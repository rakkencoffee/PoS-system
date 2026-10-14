// Mirrors a voucher's category scope from Olsera into VoucherScope (see
// schema.prisma) -- Olsera's Open API never returns that scope, so the kiosk
// can't read it itself. Run once per voucher after setting its "Berlaku untuk
// grup produk" in Olsera. A voucher with no row applies to every item.
//
// Usage: node scripts/set-voucher-scope.mjs <slug,slug,...> <CODE> [CODE...]
//        node scripts/set-voucher-scope.mjs --clear <CODE> [CODE...]
// Example: node scripts/set-voucher-scope.mjs non-coffee,refreshment Hamid1 Raisa1
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const [first, ...rest] = process.argv.slice(2);
const clear = first === "--clear";
const slugs = clear ? [] : (first || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const codes = rest.map((c) => c.toUpperCase().trim()).filter(Boolean);

if (!first || codes.length === 0 || (!clear && slugs.length === 0)) {
  console.error("Usage: node scripts/set-voucher-scope.mjs <slug,slug,...> <CODE> [CODE...]");
  console.error("       node scripts/set-voucher-scope.mjs --clear <CODE> [CODE...]");
  process.exit(1);
}

for (const code of codes) {
  if (clear) {
    await prisma.voucherScope.deleteMany({ where: { code } });
    console.log(`OK: ${code} -> berlaku untuk semua kategori`);
  } else {
    await prisma.voucherScope.upsert({
      where: { code },
      update: { categorySlugs: slugs },
      create: { code, categorySlugs: slugs },
    });
    console.log(`OK: ${code} -> ${slugs.join(", ")}`);
  }
}

await prisma.$disconnect();
