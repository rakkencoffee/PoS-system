'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cancelStuckOrder, markOrderPaid, recoverCancelledOrder, type ActionState } from '../actions';

function Result({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p
      role={state.ok ? 'status' : 'alert'}
      className={
        state.ok
          ? 'rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800'
          : 'rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'
      }
    >
      {state.message}
    </p>
  );
}

export function RecoverAction({ orderId, amountLabel, timeLabel }: { orderId: string; amountLabel: string; timeLabel: string }) {
  const [state, action, pending] = useActionState(recoverCancelledOrder, null);

  if (state?.ok) return <Result state={state} />;

  return (
    <form action={action} className="max-w-xl space-y-4 rounded-xl border border-zinc-200 p-4">
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <h3 className="font-semibold">Pulihkan ke KDS</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Pakai kalau ternyata ada struk EDC berstatus SUKSES sebesar <span className="font-medium text-zinc-800">{amountLabel}</span>{' '}
          sekitar jam <span className="font-medium text-zinc-800">{timeLabel}</span>. Order jadi lunas, masuk KDS, dan label dicetak.
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900">
          Order ini udah di-void di Olsera, jadi penjualannya nggak tercatat otomatis. Setelah dipulihkan, input manual
          penjualannya di Olsera.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="recoverReffNo">Reff No / approval code di struk EDC</Label>
        <Input id="recoverReffNo" name="reffNo" required minLength={4} maxLength={40} autoComplete="off" disabled={pending} />
      </div>
      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input type="checkbox" name="confirmed" required disabled={pending} className="mt-0.5 size-4 accent-zinc-900" />
        Saya sudah cek struk EDC-nya, nominal dan jamnya cocok.
      </label>
      <Result state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Memulihkan...' : 'Pulihkan ke KDS'}
      </Button>
    </form>
  );
}

export function OrderActions({ orderId, amountLabel, timeLabel }: { orderId: string; amountLabel: string; timeLabel: string }) {
  const [paidState, paidAction, paidPending] = useActionState(markOrderPaid, null);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelStuckOrder, null);
  const busy = paidPending || cancelPending;

  if (paidState?.ok || cancelState?.ok) {
    return <Result state={paidState?.ok ? paidState : cancelState} />;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form action={paidAction} className="space-y-4 rounded-xl border border-zinc-200 p-4">
        <input type="hidden" name="orderId" value={orderId} />
        <div>
          <h3 className="font-semibold">Tandai sudah bayar</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Pakai kalau ada struk EDC berstatus SUKSES sebesar <span className="font-medium text-zinc-800">{amountLabel}</span> sekitar
            jam <span className="font-medium text-zinc-800">{timeLabel}</span>. Pesanan langsung masuk KDS, label dicetak, dan tercatat
            lunas di Olsera.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reffNo">Reff No / approval code di struk EDC</Label>
          <Input id="reffNo" name="reffNo" required minLength={4} maxLength={40} autoComplete="off" disabled={busy} />
        </div>
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="confirmed" required disabled={busy} className="mt-0.5 size-4 accent-zinc-900" />
          Saya sudah cek struk EDC-nya, nominal dan jamnya cocok.
        </label>
        <Result state={paidState} />
        <Button type="submit" disabled={busy} className="w-full">
          {paidPending ? 'Memproses...' : 'Tandai sudah bayar'}
        </Button>
      </form>

      <form action={cancelAction} className="space-y-4 rounded-xl border border-zinc-200 p-4">
        <input type="hidden" name="orderId" value={orderId} />
        <div>
          <h3 className="font-semibold">Batalkan order</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Pakai kalau memang nggak ada struk EDC yang sukses untuk order ini. Order dibatalkan dan di-void di Olsera.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="confirmed" required disabled={busy} className="mt-0.5 size-4 accent-zinc-900" />
          Saya sudah cek, nggak ada struk EDC yang sukses untuk order ini.
        </label>
        <Result state={cancelState} />
        <Button type="submit" variant="destructive" disabled={busy} className="w-full">
          {cancelPending ? 'Membatalkan...' : 'Batalkan order'}
        </Button>
      </form>
    </div>
  );
}
