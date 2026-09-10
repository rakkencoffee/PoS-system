import { NextRequest, NextResponse } from 'next/server';
import { sendPushToAllMembers } from '@/lib/push';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * POST /api/member/admin/push/broadcast
 *
 * Admin sends one push notification to every member with at least one
 * active PushSubscription (promo/announcement use case). Body: { title,
 * body, url? }. Fire-and-forget per-subscription failures are handled
 * inside sendPushToAllMembers() — this endpoint just reports how many
 * subscriptions existed at broadcast time, not per-recipient delivery
 * status (web-push doesn't give us that).
 */
export async function POST(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { title, body, url } = await request.json();
  if (!title || !body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
  }

  await sendPushToAllMembers({ title, body, url });
  return NextResponse.json({ success: true });
}
