import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * PATCH /api/member/:id
 *
 * Edit profile fields from the Profil page. Only phone and birthDate are
 * editable here — name/email come from Neon Auth / onboarding and aren't
 * meant to change through this endpoint.
 * Body: { phone?: string, birthDate?: string (ISO date) }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id } = await params;
  const body = await request.json();
  const data: { phone?: string; birthDate?: Date } = {};

  if (typeof body.phone === 'string' && body.phone.trim()) {
    data.phone = body.phone.trim();
  }
  if (typeof body.birthDate === 'string' && body.birthDate.trim()) {
    data.birthDate = new Date(body.birthDate);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const member = await prisma.member.update({ where: { id }, data });
    return NextResponse.json(member);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Nomor HP sudah dipakai member lain' }, { status: 409 });
    }
    console.error('[Member Profile] Failed to update:', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
