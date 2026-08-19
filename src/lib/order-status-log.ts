import { prisma } from '@/lib/db';

export type StatusLogSource =
  | 'order_created'
  | 'midtrans_webhook'
  | 'midtrans_manual_verify'
  | 'system_voucher_100'
  | 'olsera_settlement'
  | 'kds_manual'
  | 'olsera_webhook'
  | 'system_recovery';

export type StatusField = 'order' | 'barista' | 'kitchen';

export async function logOrderStatusChange(params: {
  orderId: string;
  statusField: StatusField;
  fromStatus: string | null;
  toStatus: string;
  source: StatusLogSource;
  actorId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.orderStatusLog.create({
      data: {
        orderId: params.orderId,
        statusField: params.statusField,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        source: params.source,
        actorId: params.actorId,
        metadata: params.metadata as any,
      },
    });
  } catch (err) {
    // Jurnal TIDAK BOLEH menggagalkan flow bisnis utama (pembayaran, update KDS, dst).
    console.error('[OrderStatusLog] Failed to write log:', err);
  }
}
