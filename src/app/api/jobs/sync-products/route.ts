import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { NextResponse } from 'next/server';
import { syncProductsFromOlsera } from '@/lib/integrations/olsera-sync';

/**
 * Background Job: Sync Products
 * 
 * This endpoint is triggered by QStash (Crontab) every 5 minutes.
 * It uses Upstash Signature Verification to ensure only QStash can call it.
 */

async function handler(req: Request) {
  try {
    console.log('[Job] 🏃 Scheduled sync job started...');
    
    const result = await syncProductsFromOlsera();
    
    return NextResponse.json({ 
      success: true, 
      message: `Sync completed: ${result.count} products processed` 
    });
  } catch (err: any) {
    console.error('[Job] ❌ Sync job failed:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  }
}

// Wrap with QStash signature verification for production security
// In development/test mode, we might want to bypass this
export const POST = process.env.NODE_ENV === 'production' 
  ? verifySignatureAppRouter(handler) 
  : handler;
