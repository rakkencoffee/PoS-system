import { NextResponse } from 'next/server';

/**
 * Olsera Webhook Receiver
 * 
 * Path: /api/webhooks/olsera
 * Function: Receives real-time updates for products, stock, and orders.
 */

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  
  try {
    const headers = Object.fromEntries(req.headers.entries());
    const body = await req.json().catch(() => ({}));

    console.log(`[Olsera Webhook] [${timestamp}] Received event`);
    console.log(`[Olsera Webhook] Headers:`, {
      'x-olsera-event': headers['x-olsera-event'],
      'x-olsera-signature': headers['x-olsera-signature'] ? '***PRESENT***' : 'MISSING'
    });
    console.log(`[Olsera Webhook] Payload:`, JSON.stringify(body, null, 2));

    const event = headers['x-olsera-event'];

    // Handle specific events
    switch (event) {
      case 'product.updated':
        console.log(`[Olsera Webhook] Handling product update for SKU: ${body.sku || 'unknown'}`);
        // Action: Invalidate cache or update DB (Sprint 2 integration)
        break;
      case 'stock.updated':
        console.log(`[Olsera Webhook] Handling stock update`);
        break;
      default:
        console.log(`[Olsera Webhook] Event ${event} received but not specifically handled.`);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Event received and logged',
      receivedAt: timestamp
    }, { status: 200 });

  } catch (err: any) {
    console.error(`[Olsera Webhook] [${timestamp}] Error tracking webhook:`, err.message);
    // Always return 200 during initial setup to keep Olsera happy
    return NextResponse.json({ success: true, error: 'Partial processing error' }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'active',
    service: 'Rakken POS Connector',
    endpoint: '/api/webhooks/olsera',
    documentation: 'https://developer.olsera.com/webhooks'
  }, { status: 200 });
}
