import { NextResponse } from 'next/server';

/**
 * Olsera Webhook Receiver (Dummy for Initial Setup)
 * 
 * This endpoint is created so the Olsera Dashboard can verify the Callback URL.
 * In Choice A architecture, this will be expanded to handle:
 * - product.updated
 * - stock.updated
 */

export async function POST(req: Request) {
  try {
    // For now, always return 200 to allow Olsera validation
    console.log('[Olsera Webhook] Received POST request for validation');
    
    // We can log the body to see what Olsera sends during verification
    const body = await req.json().catch(() => ({}));
    console.log('[Olsera Webhook] Payload:', body);

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook received' 
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

export async function GET() {
  // Some systems verify via GET during setup
  return NextResponse.json({ 
    status: 'active',
    endpoint: '/api/webhooks/olsera'
  }, { status: 200 });
}
