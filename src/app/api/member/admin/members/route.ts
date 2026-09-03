import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/admin/members
 *
 * List members for the admin dashboard's member list (PRD Bab 10.2 —
 * "lihat daftar member, lihat riwayat order per member").
 */
export async function GET(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const members = await prisma.member.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { orders: true } } },
  });

  return NextResponse.json(members);
}
