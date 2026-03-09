import { NextResponse } from 'next/server';
import { getClientKey, isProduction } from '@/lib/integrations/midtrans.service';
import { isOlseraEnabled } from '@/lib/integrations/pos.adapter';

/**
 * GET /api/payment/config
 *
 * Returns Midtrans client-side config (client key, environment).
 * Used by frontend to initialize Snap.js.
 */
export async function GET() {
  return NextResponse.json({
    clientKey: getClientKey(),
    isProduction: isProduction(),
    snapUrl: isProduction()
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js',
    olseraEnabled: isOlseraEnabled(),
  });
}
