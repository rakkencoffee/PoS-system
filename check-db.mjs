import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' }
  });
  console.log('Recent 20 orders in Prisma:');
  console.log(JSON.stringify(orders.map(o => ({
    id: o.id,
    status: o.status,
    baristaStatus: o.baristaStatus,
    kitchenStatus: o.kitchenStatus,
    olseraTransactionId: o.olseraTransactionId,
    createdAt: o.createdAt
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
