// One-off: create/reset kitchen & barista KDS login accounts (password = username).
// Runs inside the Vercel build step so it picks up the real production
// DATABASE_URL (not obtainable locally) — see feedback_rakken_pos_prisma_db_push.
// Discovered production only has the `admin` user — kitchen/barista never
// existed there (only ever created on the dev/preview DB) — so this upserts
// instead of just updating.
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const accounts = [
    { username: 'kitchen', name: 'Kitchen' },
    { username: 'barista', name: 'Barista' },
  ];

  for (const { username, name } of accounts) {
    const passwordHash = await bcrypt.hash(username, 10);
    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, name, passwordHash, role: 'KITCHEN' },
    });
    console.log(`[ResetPassword] ${username}: id=${user.id} role=${user.role}`);
  }

  await prisma.$disconnect();
})();
