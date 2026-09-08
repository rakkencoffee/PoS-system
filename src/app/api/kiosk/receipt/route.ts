import { NextRequest, NextResponse } from 'next/server';
import { formatReceipt, type ReceiptData } from '@/lib/print/format-receipt';

/**
 * POST /api/kiosk/receipt
 *
 * Public (no auth, same as /api/edc-jobs/status) — formats a receipt into
 * raw ESC/POS bytes for the kiosk tablet's own paired Bluetooth printer to
 * write directly (see useBlePrinter.ts). Kept stateless (data comes straight
 * from the client's own checkout state, not a stored PrintJob) so the kiosk
 * doesn't have to wait on a server-side job row to exist before printing.
 *
 * Body: ReceiptData (orderId, queueNumber, items, total, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as ReceiptData;

    if (!data || typeof data.total !== 'number') {
      return NextResponse.json({ error: 'total is required' }, { status: 400 });
    }

    // Auto-cut via software GS V command -- confirmed working cleanly on the
    // IW-J300H (see format-receipt.ts), unlike the printer's own firmware
    // "Auto Append Cut Function" which jammed. Was left off here (likely an
    // oversight from when this endpoint was first built), so kiosk receipts
    // never got cut even though the mechanism already worked.
    const buffer = formatReceipt(data, 48, true);
    return NextResponse.json({ bytes: buffer.toString('base64') });
  } catch (error) {
    console.error('[KioskReceipt] Failed to format receipt:', error);
    return NextResponse.json({ error: 'Failed to format receipt' }, { status: 500 });
  }
}
