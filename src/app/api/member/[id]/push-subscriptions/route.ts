import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * POST /api/member/:id/push-subscriptions
 *
 * Saves the PushSubscription object the browser's PushManager.subscribe()
 * returns after the member grants notification permission. Upserted by
 * `endpoint` (globally unique per browser install) so re-subscribing the
 * same device — e.g. after a keys rotation the browser does on its own —
 * never creates a duplicate row.
 * Body: { endpoint, keys: { p256dh, auth } }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: memberId } = await params;
  const body = await request.json();
  const { endpoint, keys } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'endpoint and keys.p256dh/keys.auth are required' }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { memberId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { memberId, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/member/:id/push-subscriptions
 *
 * Removes one subscription — called when the member turns notifications
 * off. Body: { endpoint }. Scoped to memberId so a member can't unsubscribe
 * someone else's device by guessing an endpoint.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: memberId } = await params;
  const { endpoint } = await request.json();
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({ where: { memberId, endpoint } });
  return NextResponse.json({ success: true });
}
