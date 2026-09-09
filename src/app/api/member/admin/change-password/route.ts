import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

const ChangePasswordSchema = z.object({
  userId: z.string().min(1),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

/**
 * POST /api/member/admin/change-password
 *
 * Lets an admin change their own staff-login password (same User table
 * NextAuth's Credentials provider uses — see src/lib/auth.ts). Called by
 * the Member App's admin settings page after it's already confirmed the
 * caller has a valid admin_session cookie (see requireAdminSession() in
 * rakken-member-app) — this route only re-checks the CURRENT password,
 * not the session, since it has no session of its own to check.
 */
export async function POST(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const parsed = ChangePasswordSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'userId, currentPassword, and a newPassword of at least 6 characters are required' }, { status: 400 });
  }
  const { userId, currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newPasswordHash } });

  return NextResponse.json({ success: true });
}
