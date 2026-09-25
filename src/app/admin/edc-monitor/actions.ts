'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
