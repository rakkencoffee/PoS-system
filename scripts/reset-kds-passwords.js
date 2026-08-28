// One-off: list all User rows (read-only) to find the real kitchen/barista
// usernames in production before resetting their passwords.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, role: true },
  });
  console.log('[ListUsers]', JSON.stringify(users, null, 2));
  await prisma.$disconnect();
})();
