// READ-ONLY — cuma SELECT, gak ada DELETE/UPDATE. Dipakai sekali lewat build
// step buat liat data duplikat sebelum apply unique constraint PrintJob.orderId.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const dupes = await prisma.$queryRaw`
      SELECT "orderId", COUNT(*) as cnt, array_agg(id ORDER BY "createdAt" DESC) as ids, array_agg(status ORDER BY "createdAt" DESC) as statuses, array_agg("createdAt" ORDER BY "createdAt" DESC) as created_ats
      FROM "PrintJob"
      GROUP BY "orderId"
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
    `;
    console.log(`=== DUPLICATE orderId GROUPS: ${dupes.length} ===`);
    console.log(JSON.stringify(dupes, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

    const totalRows = await prisma.printJob.count();
    console.log(`=== TOTAL PrintJob rows: ${totalRows} ===`);
  } catch (e) {
    console.error('INSPECT ERROR', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
