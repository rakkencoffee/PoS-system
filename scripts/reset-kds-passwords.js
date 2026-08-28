// One-off: reset kitchen/barista KDS login passwords (password = username).
// Runs inside the Vercel build step so it picks up the real production
// DATABASE_URL (not obtainable locally) — see feedback_rakken_pos_prisma_db_push.
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const updates = [
    { username: 'kitchen', password: 'kitchen' },
    { username: 'barista', password: 'barista' },
  ];

  for (const { username, password } of updates) {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await prisma.user.updateMany({
      where: { username },
      data: { passwordHash },
    });
    console.log(`[ResetPassword] ${username}: matched ${result.count} row(s)`);
  }

  await prisma.$disconnect();
})();
