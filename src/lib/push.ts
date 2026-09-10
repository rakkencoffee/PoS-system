import webpush from 'web-push';
import { prisma } from '@/lib/db';

/**
 * Web Push (Lapis 2 notifikasi — Lapis 1 realtime-while-open sudah ada via
 * Pusher, ini yang bisa nyampe walau tab/app-nya ketutup). VAPID keys
 * di-generate sekali (crypto.randomBytes lewat webpush.generateVAPIDKeys()),
 * PRIVATE key cuma di sini (server), PUBLIC key juga dibutuhin browser buat
 * PushManager.subscribe() — lihat NEXT_PUBLIC_VAPID_PUBLIC_KEY di Member App.
 */
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:rakkencoffee@gmail.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export type PushPayload = { title: string; body: string; url?: string };

/**
 * Sends to every subscription in `subscriptions`, silently dropping ones
 * the push service reports as gone (410/404 — browser unsubscribed or
 * uninstalled, expected to happen over time) so they stop being retried
 * forever. Any other error is logged but non-fatal — one member's broken
 * subscription should never block sending to everyone else.
 */
async function sendToSubscriptions(
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
) {
  const body = JSON.stringify(payload);
  const staleIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.warn(`[Push] Failed to send to subscription ${sub.id}:`, err?.message || err);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
  }
}

export async function sendPushToMember(memberId: string, payload: PushPayload) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { memberId } });
  if (subscriptions.length === 0) return;
  await sendToSubscriptions(subscriptions, payload);
}

export async function sendPushToMembers(memberIds: string[], payload: PushPayload) {
  if (memberIds.length === 0) return;
  const subscriptions = await prisma.pushSubscription.findMany({ where: { memberId: { in: memberIds } } });
  if (subscriptions.length === 0) return;
  await sendToSubscriptions(subscriptions, payload);
}

export async function sendPushToAllMembers(payload: PushPayload) {
  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return;
  await sendToSubscriptions(subscriptions, payload);
}
