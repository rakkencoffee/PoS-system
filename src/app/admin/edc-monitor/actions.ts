'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logOrderStatusChange } from '@/lib/order-status-log';
import { isKitchenCategory } from '@/lib/promo-categories';

const ALLOWED_ROLES = ['ADMIN', 'MANAGER'];
// Only orders that really exist in Olsera can be settled here -- local-only
// "SF-..." ids would go through the recovery path, which creates an Olsera
// order with no items.
const REAL_OLSERA_ID = /^OLSERA-\d+$/;

export type ActionState = { ok: boolean; message: string } | null;

async function requireStaff() {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null; role?: string } | undefined;
  if (!user?.role || !ALLOWED_ROLES.includes(user.role)) return null;
  return user;
}

function refresh(orderId: string) {
  revalidatePath('/admin/edc-monitor');
  revalidatePath(`/admin/edc-monitor/${orderId}`);
}

export async function markOrderPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  if (!user) return { ok: false, message: 'Sesi habis atau akun nggak punya akses. Login ulang dulu.' };

  const orderId = String(formData.get('orderId') ?? '');
  const reffNo = String(formData.get('reffNo') ?? '').trim();

  if (formData.get('confirmed') !== 'on') {
    return { ok: false, message: 'Centang konfirmasi bahwa struk EDC-nya udah kamu cek.' };
  }
  if (reffNo.length < 4 || reffNo.length > 40) {
    return { ok: false, message: 'Isi Reff No atau approval code dari struk EDC (4 sampai 40 karakter).' };
  }
  if (!REAL_OLSERA_ID.test(orderId)) {
    return { ok: false, message: 'Order ini nggak punya pasangan di Olsera, jadi belum bisa ditandai lunas dari sini.' };
  }

  // Claim the order first so a double click or two admins at once can't
  // settle it (and print its labels) twice.
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, status: 'PENDING' },
    data: { status: 'PROCESSING' },
  });
  if (claimed.count !== 1) {
    return { ok: false, message: 'Order ini udah nggak berstatus PENDING, mungkin udah diproses orang lain. Muat ulang halaman.' };
  }

  const [order, latestJob] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId }, select: { total: true } }),
    prisma.edcJob.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } }),
  ]);

  const { updateOrderPaymentStatus } = await import('@/lib/integrations/pos.adapter');
  await updateOrderPaymentStatus(orderId, 'paid', latestJob?.amount ?? order?.total ?? 0, 'admin_manual_paid', {
    reffNo,
    actorId: user.id ?? null,
    actorName: user.name ?? null,
    previousEdcStatus: latestJob?.status ?? null,
  });

  // updateOrderPaymentStatus swallows its own failures, so check the outcome.
  const after = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (after?.status !== 'PAID') {
    await prisma.order.updateMany({ where: { id: orderId, status: 'PROCESSING' }, data: { status: 'PENDING' } });
    refresh(orderId);
    return {
      ok: false,
      message: 'Gagal mencatat pembayaran ke Olsera. Order dikembalikan ke PENDING, coba lagi beberapa saat lagi.',
    };
  }

  refresh(orderId);
  return { ok: true, message: 'Order ditandai lunas. Pesanan dikirim ke KDS dan label dicetak otomatis.' };
}

// For an order the kiosk cancelled (and voided in Olsera) although the EDC
// receipt shows it was paid. Olsera can't take it back, so this only brings
// it back locally: PAID, onto the KDS boards, labels printed. The sale has to
// be entered in Olsera by hand.
export async function recoverCancelledOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  if (!user) return { ok: false, message: 'Sesi habis atau akun nggak punya akses. Login ulang dulu.' };

  const orderId = String(formData.get('orderId') ?? '');
  const reffNo = String(formData.get('reffNo') ?? '').trim();

  if (formData.get('confirmed') !== 'on') {
    return { ok: false, message: 'Centang konfirmasi bahwa struk EDC-nya udah kamu cek.' };
  }
  if (reffNo.length < 4 || reffNo.length > 40) {
    return { ok: false, message: 'Isi Reff No atau approval code dari struk EDC (4 sampai 40 karakter).' };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, baristaStatus: true, kitchenStatus: true, items: { select: { name: true } } },
  });
  if (order?.status !== 'CANCELLED') {
    return { ok: false, message: 'Order ini udah nggak berstatus CANCELLED. Muat ulang halaman.' };
  }

  // The void in Olsera echoes back through its webhook as CANCELLED on both
  // stations, so recompute which stations actually have work to do.
  const { getMenuItems, triggerPrintJobBroadcast } = await import('@/lib/integrations/pos.adapter');
  let categoryByName = new Map<string, string>();
  try {
    categoryByName = new Map((await getMenuItems({ includeUnavailable: true })).map((m) => [m.name, m.categorySlug]));
  } catch (err) {
    console.warn('[Recover] Menu lookup failed, routing every item by name:', err);
  }
  const kitchenItem = (name: string) => isKitchenCategory(categoryByName.get(name) ?? name);
  const baristaStatus = order.items.some((i) => !kitchenItem(i.name)) ? 'PENDING' : 'COMPLETED';
  const kitchenStatus = order.items.some((i) => kitchenItem(i.name)) ? 'PENDING' : 'COMPLETED';

  // Claim in one conditional write so a double submit can't recover (and
  // print) twice.
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, status: 'CANCELLED' },
    data: { status: 'PAID', baristaStatus, kitchenStatus },
  });
  if (claimed.count !== 1) {
    return { ok: false, message: 'Order ini udah dipulihkan orang lain. Muat ulang halaman.' };
  }

  const metadata = { reffNo, actorId: user.id ?? null, actorName: user.name ?? null, olseraSynced: false };
  await logOrderStatusChange({ orderId, statusField: 'order', fromStatus: 'CANCELLED', toStatus: 'PAID', source: 'admin_manual_recover', actorId: user.id, metadata });
  await logOrderStatusChange({ orderId, statusField: 'barista', fromStatus: order.baristaStatus, toStatus: baristaStatus, source: 'admin_manual_recover', actorId: user.id });
  await logOrderStatusChange({ orderId, statusField: 'kitchen', fromStatus: order.kitchenStatus, toStatus: kitchenStatus, source: 'admin_manual_recover', actorId: user.id });

  try {
    const { pusherServer } = await import('@/lib/pusher');
    await pusherServer.trigger('kitchen', 'ORDER_CREATED', { order: { id: orderId } });
  } catch (err) {
    console.warn('[Recover] KDS broadcast failed (boards still pick it up on their next refresh):', err);
  }
  await triggerPrintJobBroadcast(orderId);

  refresh(orderId);
  return {
    ok: true,
    message: 'Order dipulihkan: masuk KDS dan label dicetak. Jangan lupa input penjualannya manual di Olsera.',
  };
}

export async function cancelStuckOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  if (!user) return { ok: false, message: 'Sesi habis atau akun nggak punya akses. Login ulang dulu.' };

  const orderId = String(formData.get('orderId') ?? '');
  if (formData.get('confirmed') !== 'on') {
    return { ok: false, message: 'Centang konfirmasi bahwa nggak ada struk EDC yang sukses untuk order ini.' };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (order?.status !== 'PENDING') {
    return { ok: false, message: 'Order ini udah nggak berstatus PENDING. Muat ulang halaman.' };
  }

  const { cancelOrder } = await import('@/lib/integrations/pos.adapter');
  await cancelOrder(orderId, 'admin_manual_cancel');

  const after = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  refresh(orderId);
  if (after?.status !== 'CANCELLED') {
    return { ok: false, message: 'Gagal membatalkan order. Coba lagi.' };
  }
  return { ok: true, message: 'Order dibatalkan dan di-void di Olsera.' };
}
