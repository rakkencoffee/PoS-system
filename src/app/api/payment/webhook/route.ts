import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, parseTransactionStatus } from '@/lib/integrations/midtrans.service';
import { updateOrderPaymentStatus } from '@/lib/integrations/pos.adapter';

/**
 * POST /api/payment/webhook
 *
 * Midtrans notification webhook handler.
 * Called by Midtrans when payment status changes.
 *
 * Payload from Midtrans: {
 *   transaction_status, order_id, status_code,
 *   gross_amount, signature_key, payment_type, fraud_status?
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      order_id,
      transaction_status,
      status_code,
      gross_amount,
      signature_key,
      fraud_status,
      payment_type,
    } = body;

    console.log('[Midtrans Webhook]', {
      order_id,
      transaction_status,
      status_code,
      payment_type,
    });

    // Verify signature
    const isValid = verifyWebhookSignature(
      order_id,
      status_code,
      gross_amount,
      signature_key
    );

    if (!isValid) {
      console.warn('[Midtrans Webhook] Invalid signature for order:', order_id);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Parse status
    const status = parseTransactionStatus(transaction_status, fraud_status);

    // Update order in POS
    if (status === 'success') {
      await updateOrderPaymentStatus(order_id, 'paid');
    } else if (status === 'failed') {
      await updateOrderPaymentStatus(order_id, 'failed');
    } else if (status === 'expired') {
      await updateOrderPaymentStatus(order_id, 'expired');
    }
    // 'pending' → no action needed, wait for final status

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing Midtrans webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
