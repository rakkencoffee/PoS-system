import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';
import { findCustomerByPhone, createCustomer } from '@/lib/integrations/olsera.service';

/**
 * POST /api/member/onboarding
 *
 * Called once, right after a brand-new Neon Auth login, when the caller has
 * just collected phone + birthDate from the Onboarding form. Creates the
 * Member row — this is the only place a Member row gets created.
 *
 * Body: { neonAuthUserId, email, name, phone, birthDate (ISO string) }
 */
export async function POST(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const body = await request.json();
  const { neonAuthUserId, email, name, phone, birthDate } = body;

  if (!neonAuthUserId || !email || !name || !phone || !birthDate) {
    return NextResponse.json(
      { error: 'neonAuthUserId, email, name, phone, and birthDate are required' },
      { status: 400 }
    );
  }

  // Search-or-create Olsera customer, so the member is discoverable by phone
  // at the kiosk too (see PRD Bab 4.1 sequence diagram).
  let olseraCustomerId: string;
  try {
    const existing = await findCustomerByPhone(phone);
    if (existing) {
      olseraCustomerId = String(existing.id);
    } else {
      const created = await createCustomer(name, phone, email);
      olseraCustomerId = String(created.id);
    }
  } catch (err) {
    console.error('[Member Onboarding] Olsera sync failed:', err);
    return NextResponse.json(
      { error: 'Failed to sync with Olsera CRM. Try again.' },
      { status: 502 }
    );
  }

  try {
    const member = await prisma.member.create({
      data: {
        neonAuthUserId,
        email,
        name,
        phone,
        birthDate: new Date(birthDate),
        olseraCustomerId,
      },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A member with this account, email, or phone already exists' },
        { status: 409 }
      );
    }
    console.error('[Member Onboarding] Failed to create Member row:', err);
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
}
