// prisma/seed.ts
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminUsername = 'admin';
  const adminPassword = 'rakkenadminpos'; // Silakan ganti setelah login pertama

  console.log('🌱 Seeding database...');

  // 1. Create Admin User
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  const user = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
    create: {
      username: adminUsername,
      name: 'Administrator',
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Admin user created:`);
  console.log(`   Username: ${adminUsername}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   Role: ${user.role}`);

  // 2. TierRule — 4 tier loyalty RAKKEN Member App, final per keputusan
  // 2026-09-09 (lihat project_rakken_loyalty_app memory). upsert by level
  // supaya aman dijalankan ulang tanpa bikin duplikat.
  const tierRules = [
    { level: 1, name: 'Bean Seeker', minSpend: 0, upgradeVoucherPercent: 0, weeklyDiscountPercent: 0, birthdayFreeBeverage: false, birthdayFreeSnack: false, birthdayFreeMerch: false },
    { level: 2, name: 'Brew Explorer', minSpend: 500_000, upgradeVoucherPercent: 50, weeklyDiscountPercent: 20, birthdayFreeBeverage: true, birthdayFreeSnack: false, birthdayFreeMerch: false },
    { level: 3, name: 'Roast Keeper', minSpend: 2_000_000, upgradeVoucherPercent: 80, weeklyDiscountPercent: 20, birthdayFreeBeverage: true, birthdayFreeSnack: true, birthdayFreeMerch: false },
    { level: 4, name: 'Coffee Master', minSpend: 4_000_000, upgradeVoucherPercent: 100, weeklyDiscountPercent: 20, birthdayFreeBeverage: true, birthdayFreeSnack: true, birthdayFreeMerch: true },
  ];

  for (const rule of tierRules) {
    await prisma.tierRule.upsert({
      where: { level: rule.level },
      update: rule,
      create: rule,
    });
  }

  console.log(`✅ TierRule seeded: ${tierRules.map((r) => r.name).join(', ')}`);

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
