import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * POST /api/member/:id/photo
 *
 * Member's own custom profile photo — new members start with `photoUrl:
 * null`, which the frontend renders as a system-provided default avatar
 * (no default image asset lives on the backend). This endpoint is how a
 * member replaces that default with their own photo (uploaded from
 * gallery or taken live — both arrive here as the same multipart file,
 * the camera-vs-gallery choice is a frontend/HTML input concern).
 * Body: multipart/form-data, field "photo".
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: memberId } = await params;

  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { photoUrl: true } });
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('photo');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'photo file is required' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, or WEBP images are allowed' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File is too large (max 5MB)' }, { status: 400 });
  }

  const extension = file.type.split('/')[1];
  const blob = await put(`member-photos/${memberId}-${Date.now()}.${extension}`, file, {
    access: 'public',
    contentType: file.type,
  });

  const previousPhotoUrl = member.photoUrl;
  await prisma.member.update({ where: { id: memberId }, data: { photoUrl: blob.url } });

  if (previousPhotoUrl) {
    // Best-effort — an orphaned old blob costs a few KB of storage, not
    // worth failing the request over if this errors.
    del(previousPhotoUrl).catch((err) => console.warn('[Member Photo] Failed to delete old blob:', err));
  }

  return NextResponse.json({ photoUrl: blob.url });
}

/**
 * DELETE /api/member/:id/photo
 *
 * Reverts to the default avatar (sets photoUrl back to null).
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: memberId } = await params;
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { photoUrl: true } });
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  await prisma.member.update({ where: { id: memberId }, data: { photoUrl: null } });

  if (member.photoUrl) {
    del(member.photoUrl).catch((err) => console.warn('[Member Photo] Failed to delete blob:', err));
  }

  return NextResponse.json({ success: true });
}
