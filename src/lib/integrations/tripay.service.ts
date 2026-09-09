/**
 * Tripay Payment Gateway Service
 *
 * Docs: https://tripay.co.id/developer
 * Used by the Member App's checkout (Bab "Payment gateway" in
 * project_rakken_loyalty_app memory) — kiosk keeps its own EDC-based flow,
 * this is only for online/remote orders where there's no physical terminal.
 *
 * Flow: create a QRIS2 "closed payment" transaction with a fixed amount,
 * show the returned qr_url inline, then Tripay POSTs a signed callback to
 * /api/webhooks/tripay once the customer pays.
 */

import crypto from 'crypto';

function getEnv() {
  return {
    BASE_URL: (process.env.TRIPAY_BASE_URL || '').replace(/\/+$/, ''),
    MERCHANT_CODE: process.env.TRIPAY_MERCHANT_CODE || '',
    API_KEY: process.env.TRIPAY_API_KEY || '',
    PRIVATE_KEY: process.env.TRIPAY_PRIVATE_KEY || '',
  };
}

function signCreateTransaction(merchantCode: string, merchantRef: string, amount: number, privateKey: string): string {
  return crypto
    .createHmac('sha256', privateKey)
    .update(merchantCode + merchantRef + amount)
    .digest('hex');
}

export type CreateQrisTransactionResult = {
  reference: string;
  qrUrl: string;
  qrString: string;
  status: string;
};

/**
 * Creates a QRIS2 closed-payment transaction for one order. merchantRef is
 * our own Order.id — Tripay echoes it back in the callback so we can look
 * the order up without needing to store their reference first.
 */
export async function createQrisTransaction(params: {
  merchantRef: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderItems: { name: string; price: number; quantity: number }[];
  callbackUrl: string;
}): Promise<CreateQrisTransactionResult> {
  const { BASE_URL, MERCHANT_CODE, API_KEY, PRIVATE_KEY } = getEnv();
  if (!BASE_URL || !MERCHANT_CODE || !API_KEY || !PRIVATE_KEY) {
    throw new Error('Tripay env vars are not fully configured');
  }

  const signature = signCreateTransaction(MERCHANT_CODE, params.merchantRef, params.amount, PRIVATE_KEY);

  const res = await fetch(`${BASE_URL}/transaction/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'QRIS2',
      merchant_ref: params.merchantRef,
      amount: params.amount,
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      customer_phone: params.customerPhone,
      order_items: params.orderItems,
      callback_url: params.callbackUrl,
      signature,
    }),
  });

  const body = await res.json();
  if (!res.ok || !body?.success) {
    throw new Error(`Tripay create-transaction failed: ${JSON.stringify(body)}`);
  }

  return {
    reference: body.data.reference,
    qrUrl: body.data.qr_url,
    qrString: body.data.qr_string,
    status: body.data.status,
  };
}

/** Constant-time comparison — avoids timing side-channels on the signature check. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verifies a callback's X-Callback-Signature against the RAW request body.
 * Must be called with the untouched body string (before JSON.parse) — Tripay
 * hashes the exact bytes they sent, not a re-serialized version of it.
 */
export function verifyCallbackSignature(rawBody: string, signatureHeader: string | null): boolean {
  const { PRIVATE_KEY } = getEnv();
  if (!PRIVATE_KEY) {
    console.error('[Tripay Webhook] TRIPAY_PRIVATE_KEY not set — rejecting callback.');
    return false;
  }
  if (!signatureHeader) return false;

  const expected = crypto.createHmac('sha256', PRIVATE_KEY).update(rawBody).digest('hex');
  return safeEqual(expected, signatureHeader);
}
