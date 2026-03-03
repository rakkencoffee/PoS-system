import prisma from './prisma';

export async function getNextQueueNumber(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const lastOrder = await prisma.order.findFirst({
    where: {
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    },
    orderBy: {
      queueNumber: 'desc',
    },
  });

  return (lastOrder?.queueNumber ?? 0) + 1;
}
