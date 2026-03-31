/**
 * Midtrans Payment Gateway Service
 *
 * Handles Snap token creation and webhook verification.
 * Uses midtrans-client SDK for Node.js.
 *
 * Flow:
 * 1. Backend creates Snap transaction → returns snap_token
 * 2. Frontend calls window.snap.pay(snap_token)
 * 3. Midtrans sends webhook notification → backend verifies & updates order
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const midtransClient = require('midtrans-client');
import crypto from 'crypto';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || '';
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';

// Create Snap instance
const snap = new midtransClient.Snap({
  isProduction: MIDTRANS_IS_PRODUCTION,
  serverKey: MIDTRANS_SERVER_KEY,
  clientKey: MIDTRANS_CLIENT_KEY,
});

export interface PaymentItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CreateTransactionParams {
  orderId: string;
  grossAmount: number;
  items: PaymentItem[];
  customerName?: string;
  customerEmail?: string;
}

/**
 * Create a Midtrans Snap transaction token
 */
export async function createSnapTransaction(params: CreateTransactionParams): Promise<{
  token: string;
  redirect_url: string;
}> {
  const parameter = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.grossAmount,
    },
    item_details: params.items.map((item) => ({
      id: item.id,
      name: item.name.substring(0, 50), // Midtrans max 50 chars
      price: item.price,
      quantity: item.quantity,
    })),
    customer_details: {
      first_name: params.customerName || 'Kiosk Customer',
      email: params.customerEmail || 'kiosk@startfriday.co',
    },
    // Payment methods are controlled from Midtrans Dashboard
    // (Settings > Snap Preferences > Payment Channels)
    callbacks: {
      finish: '/success',
    },
  };

  const transaction = await snap.createTransaction(parameter);

  return {
    token: transaction.token,
    redirect_url: transaction.redirect_url,
  };
}

/**
 * Verify Midtrans webhook signature
 *
 * Signature = SHA512(order_id + status_code + gross_amount + server_key)
 */
export function verifyWebhookSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const payload = orderId + statusCode + grossAmount + MIDTRANS_SERVER_KEY;
  const expectedSignature = crypto.createHash('sha512').update(payload).digest('hex');
  return expectedSignature === signatureKey;
}

/**
 * Parse Midtrans transaction status to a simple status
 */
export function parseTransactionStatus(transactionStatus: string, fraudStatus?: string): 'success' | 'pending' | 'failed' | 'expired' {
  if (transactionStatus === 'capture') {
    return fraudStatus === 'accept' ? 'success' : 'pending';
  }
  if (transactionStatus === 'settlement') return 'success';
  if (transactionStatus === 'pending') return 'pending';
  if (['deny', 'cancel', 'failure'].includes(transactionStatus)) return 'failed';
  if (transactionStatus === 'expire') return 'expired';
  return 'pending';
}

/**
 * Get the Midtrans client key for frontend use
 */
export function getClientKey(): string {
  return MIDTRANS_CLIENT_KEY;
}

/**
 * Check if Midtrans is in production mode
 */
export function isProduction(): boolean {
  return MIDTRANS_IS_PRODUCTION;
}
