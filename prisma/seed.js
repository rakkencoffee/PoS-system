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
