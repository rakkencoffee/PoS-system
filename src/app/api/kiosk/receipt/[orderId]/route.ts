import { NextRequest, NextResponse } from 'next/server';
import { formatReceipt, type ReceiptData } from '@/lib/print/format-receipt';
import { prisma } from '@/lib/db';

/**
 * GET /api/kiosk/receipt/[orderId]
 *
 * Public (no auth, same as /api/edc-jobs/status) — formats a receipt into raw
 * ESC/POS bytes for the kiosk tablet's own paired Bluetooth printer, pulled
 * from the already-created PrintJob row instead of live client cart state.
 *
 * This is what KioskPrinterProvider calls once it sees an order's EDC job go
 * APPROVED (via Pusher), independent of whether the checkout tab that placed
 * the order is even still open -- the same server-driven pattern KDS
 * printing already uses (StationPrinterPanel + PrintJob), so a customer
 * cancelling out of the waiting screen or the idle timeout kicking in no
 * longer means the receipt silently never prints (confirmed live
 * 2026-09-08: QRIS approvals that took a while only got as far as the KDS
 * sticker, not the kiosk nota, because printing lived entirely in the
 * checkout page's own component state).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;

    const job = await prisma.printJob.findUnique({ where: { orderId } });
    if (!job) {
      return NextResponse.json({ error: 'Print job not found for this order' }, { status: 404 });
    }

    const buffer = formatReceipt(job.payload as unknown as ReceiptData, 48, true);
    return NextResponse.json({ bytes: buffer.toString('base64') });
  } catch (error) {
    console.error('[KioskReceipt] Failed to format receipt from PrintJob:', error);
    return NextResponse.json({ error: 'Failed to format receipt' }, { status: 500 });
  }
}
