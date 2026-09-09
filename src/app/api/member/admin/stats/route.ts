import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/admin/stats — 3 headline numbers for the Admin Overview
 * page: Total Member, Poin Beredar (sum of all pointBalance), Order Hari
 * Ini (MEMBER_APP orders created since 00:00 WIB today).
 */
export async function GET(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const startOfDayWIB = new Date(
    Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate())
  );
  const startOfDayUTC = new Date(startOfDayWIB.getTime() - 7 * 60 * 60 * 1000);

  const [totalMembers, pointAggregate, ordersToday] = await Promise.all([
    prisma.member.count(),
    prisma.member.aggregate({ _sum: { pointBalance: true } }),
    prisma.order.count({ where: { channel: 'MEMBER_APP', createdAt: { gte: startOfDayUTC } } }),
  ]);

  return NextResponse.json({
    totalMembers,
    totalPointsOutstanding: pointAggregate._sum.pointBalance ?? 0,
    ordersToday,
  });
}
