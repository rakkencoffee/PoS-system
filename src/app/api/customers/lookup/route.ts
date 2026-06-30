import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/customers/lookup?phone=08xxxx
 *
 * Lightweight CRM lookup used by the kiosk to greet returning customers.
 * Returns only { found, name } to avoid leaking the full customer record.
 * Never throws — a failed lookup simply returns { found: false }.
 */
export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get('phone') || '';
    const digits = phone.replace(/\D/g, '');

    if (digits.length < 8) {
      return NextResponse.json({ found: false });
    }

    const { findCustomerByPhone } = await import('@/lib/integrations/olsera.service');
    const customer = await findCustomerByPhone(digits);

    if (!customer || !customer.name) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({ found: true, name: customer.name });
  } catch (err) {
    console.warn('[Customer Lookup] error:', (err as Error)?.message);
    return NextResponse.json({ found: false });
  }
}
