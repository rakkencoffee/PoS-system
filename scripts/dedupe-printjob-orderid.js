// One-time cleanup — deletes duplicate PrintJob rows before the
// PrintJob.orderId unique constraint is applied. For each orderId with
// more than one row, keeps only the most recently created one.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const deleted = await prisma.$executeRaw`
      DELETE FROM "PrintJob"
      WHERE id NOT IN (
        SELECT DISTINCT ON ("orderId") id
        FROM "PrintJob"
        ORDER BY "orderId", "createdAt" DESC, id DESC
      )
    `;
    console.log(`[Dedupe] Deleted ${deleted} duplicate PrintJob row(s).`);

    const remaining = await prisma.printJob.count();
    console.log(`[Dedupe] PrintJob rows remaining: ${remaining}`);
  } catch (e) {
    console.error('DEDUPE ERROR', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
