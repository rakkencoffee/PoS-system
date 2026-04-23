import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export async function GET() {
  try {
    // Simulate a server-side crash
    throw new Error('Sentry Backend Test Error: ' + new Date().toISOString());
  } catch (error) {
    // Manually capture for async/try-catch blocks if needed, 
    // though Sentry usually wraps API routes automatically in Next.js
    Sentry.captureException(error);
    
    return NextResponse.json(
      { success: false, message: 'Server-side error captured by Sentry' },
      { status: 500 }
    );
  }
}
