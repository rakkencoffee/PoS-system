import { NextRequest, NextResponse } from 'next/server';
import { updateOrderPaymentStatus } from '@/lib/integrations/pos.adapter';
import { isProduction } from '@/lib/integrations/midtrans.service';

/**
 * POST /api/payment/verify
 * 
 * Verifies a transaction status directly with Midtrans.
 * Used as a fallback for local development where Webhooks cannot reach localhost.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const isProd = isProduction();
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    
    const url = isProd 
      ? `https://api.midtrans.com/v2/${orderId}/status`
      : `https://api.sandbox.midtrans.com/v2/${orderId}/status`;

    const authString = Buffer.from(`${serverKey}:`).toString('base64');
    
    // 1. Fetch real status from Midtrans
    const msRes = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authString}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    if (!msRes.ok) {
      throw new Error(`Midtrans returned ${msRes.status}`);
    }

    const msData = await msRes.json();
    
    // 2. Parse status (matches our webhook logic)
    const txStatus = msData.transaction_status;
    const fraudStatus = msData.fraud_status;
    let finalStatus: 'pending' | 'success' | 'failed' | 'expired' = 'pending';

    if (txStatus === 'capture') {
      finalStatus = fraudStatus === 'accept' ? 'success' : 'pending';
    } else if (txStatus === 'settlement') {
      finalStatus = 'success';
    } else if (['deny', 'cancel', 'failure'].includes(txStatus)) {
      finalStatus = 'failed';
    } else if (txStatus === 'expire') {
      finalStatus = 'expired';
    }

    // 3. Force sync to Olsera!
    const grossAmount = msData.gross_amount ? parseFloat(msData.gross_amount) : undefined;
    
    if (finalStatus === 'success') {
      await updateOrderPaymentStatus(orderId, 'paid', grossAmount);
    } else if (finalStatus === 'failed') {
      await updateOrderPaymentStatus(orderId, 'failed');
    } else if (finalStatus === 'expired') {
      await updateOrderPaymentStatus(orderId, 'expired');
    }

    return NextResponse.json({ 
      status: finalStatus, 
      midtrans_status: txStatus 
    });

  } catch (error: any) {
    console.error('Failed to manually verify payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
