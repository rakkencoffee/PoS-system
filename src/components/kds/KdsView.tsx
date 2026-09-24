'use client';

import { ReactNode, useEffect, useState, useMemo, useRef } from 'react';
import { Check, Inbox, Loader2, Printer, RefreshCw, Search, WifiOff, X } from 'lucide-react';
import { useKitchenOrders, useUpdateOrderStatus, getKdsLastSyncedAt } from '@/hooks/useOrders';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useQueryClient } from '@tanstack/react-query';
import { isKitchenCategory } from '@/lib/promo-categories';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function formatClock(date: Date) {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

interface KdsViewProps {
  type: 'kitchen' | 'barista';
  title: string;
  /** Extra controls rendered in the header, alongside Sync Data/clock (e.g. StationPrinterPanel). */
  headerExtra?: ReactNode;
  /** Whether the shared BLE printer is connected -- disables the per-order
      "Print Label" button (rather than hiding it) so it's still visible as
      a reminder to connect first. */
  printerConnected?: boolean;
  /**
   * Manual print fallback for one order -- a safety net for when the
   * automatic print-on-NEW_JOB in StationPrinterPanel is missed (e.g. the
   * printer wasn't connected yet, or the Pusher event never arrived). Takes
   * order.id directly; the label API routes accept that as a fallback
   * lookup alongside the PrintJob.id the automatic path uses. Resolves to a
   * short status string ("Label tercetak.", "Gagal: ...") shown next to the
   * button that triggered it.
   */
  onPrintLabel?: (orderId: string) => Promise<string>;
}

export function KdsView({ type, title, headerExtra, printerConnected, onPrintLabel }: KdsViewProps) {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading: loading, refetch: fetchOrders, isFetching: refreshing } = useKitchenOrders();
  const [printStatusByOrderId, setPrintStatusByOrderId] = useState<Record<string, string>>({});
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  const handlePrintLabel = async (orderId: string) => {
    if (!onPrintLabel) return;
    setPrintingOrderId(orderId);
    setPrintStatusByOrderId((prev) => ({ ...prev, [orderId]: '' }));
    try {
      const message = await onPrintLabel(orderId);
      setPrintStatusByOrderId((prev) => ({ ...prev, [orderId]: message }));
    } finally {
      setPrintingOrderId(null);
    }
  };
  const updateStatusMutation = useUpdateOrderStatus();
  const isOnline = useOnlineStatus();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  // Pull the last-known-good sync timestamp so the offline banner can say "as of HH:mm"
  useEffect(() => {
    if (isOnline) return;
    getKdsLastSyncedAt().then(setLastSyncedAt).catch(() => {});
  }, [isOnline]);

  // Listen for Pusher real-time updates
  useEffect(() => {
    let channel: any = null;

    async function connectPusher() {
      const { getPusherClient } = await import('@/lib/pusher');
      const pusher = getPusherClient();
      channel = pusher.subscribe('kitchen');

      channel.bind('ORDER_CREATED', (data: { order: any }) => {
        // Barista and Kitchen both listen on this same shared 'kitchen'
        // channel -- ORDER_CREATED fires for every new order regardless of
        // what's in it, and its payload doesn't even carry categorySlug per
        // item (see pos.adapter.ts's broadcast). So the notification sound
        // is NOT played here -- it's decided below, from the actual
        // category-filtered order data this station already has, once the
        // invalidation below pulls it in. Confirmed live 2026-09-24: both
        // stations were dinging for every order, including ones with
        // nothing relevant to them (e.g. Kitchen ringing for a drinks-only
        // order after Refreshment correctly moved to Barista).
        console.log('[Pusher] New order received:', data.order);
        queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen'] });
      });

      channel.bind('ORDER_UPDATED', (data: { order: any }) => {
        console.log('[Pusher] Order updated received:', data.order);
        if (data.order) {
          queryClient.setQueryData(['orders', 'kitchen'], (oldOrders: any[] | undefined) => {
            if (!oldOrders) return [];
            
            const STATUS_WEIGHTS: Record<string, number> = {
              'PENDING': 1,
              'PREPARING': 2,
              'COMPLETED': 3
            };

            return oldOrders.map(order => {
              if (String(order.id) === String(data.order.id)) {
                const oldBaristaW = STATUS_WEIGHTS[order.baristaStatus] || 0;
                const oldKitchenW = STATUS_WEIGHTS[order.kitchenStatus] || 0;
                const oldStatusW = STATUS_WEIGHTS[order.status] || 0;

                const newBaristaW = STATUS_WEIGHTS[data.order.baristaStatus] || 0;
                const newKitchenW = STATUS_WEIGHTS[data.order.kitchenStatus] || 0;
                const newStatusW = STATUS_WEIGHTS[data.order.status] || 0;

                const merged = { ...order, ...data.order };
                
                // Prevent downgrading to an older status
                if (oldBaristaW > newBaristaW) {
                  merged.baristaStatus = order.baristaStatus;
                }
                if (oldKitchenW > newKitchenW) {
                  merged.kitchenStatus = order.kitchenStatus;
                }
                if (oldStatusW > newStatusW) {
                  merged.status = order.status;
                }

                return merged;
              }
              return order;
            });
          });
        }
      });

      pusher.connection.bind('state_change', (states: any) => {
        if (states.current === 'connected') {
          queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen'] });
        }
      });
    }

    const handleOnline = () => queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen'] });
    window.addEventListener('online', handleOnline);
    connectPusher();

    return () => {
      window.removeEventListener('online', handleOnline);
      if (channel) {
        channel.unbind_all();
        channel.unsubscribe();
      }
    };
  }, [queryClient]);

  // Filtering Logic
  const filteredOrders = useMemo(() => {
    return orders.map((order: any) => {
      // Filter items based on KDS type
      const items = order.items.filter((item: any) => {
        const isCoffee = !isKitchenCategory(item.categorySlug);
        return type === 'barista' ? isCoffee : !isCoffee;
      });

      if (items.length === 0) return null;

      // Further filter by search query (Queue number, Order No, or Item name)
      const matchesSearch = 
        String(order.queueNumber).padStart(3, '0').includes(searchQuery) ||
        (order.orderNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        items.some((item: any) => item.menuItem?.name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (searchQuery && !matchesSearch) return null;

      return { ...order, items };
    }).filter(Boolean);
  }, [orders, type, searchQuery]);

  // PREPARING still happens without a Start Making button (Olsera webhook
  // moving an order to "A"), so it stays on the board alongside PENDING.
  const activeOrders = useMemo(() => {
    return filteredOrders.filter((o: any) => {
      const currentStatus = type === 'barista' ? o.baristaStatus : o.kitchenStatus;
      const displayStatus = currentStatus || o.status;
      return displayStatus === 'PENDING' || displayStatus === 'PREPARING';
    });
  }, [filteredOrders, type]);

  // IDs of PENDING orders that actually have at least one item for THIS
  // station -- built straight from `orders` (not `filteredOrders`) so an
  // active search query never hides a genuinely new order from this check.
  const pendingOrderIdsForStation = useMemo(() => {
    const ids = new Set<string>();
    for (const order of orders as any[]) {
      const currentStatus = type === 'barista' ? order.baristaStatus : order.kitchenStatus;
      if ((currentStatus || order.status) !== 'PENDING') continue;
      const hasRelevantItem = order.items.some((item: any) => {
        const isCoffee = !isKitchenCategory(item.categorySlug);
        return type === 'barista' ? isCoffee : !isCoffee;
      });
      if (hasRelevantItem) ids.add(String(order.id));
    }
    return ids;
  }, [orders, type]);

  // Plays the notification sound only when a PENDING order relevant to THIS
  // station appears that wasn't there a moment ago -- decoupled from the
  // Pusher ORDER_CREATED event on purpose (see that handler's comment).
  // `prevIdsRef` starting at null means the very first render just records
  // today's already-existing orders as the baseline instead of ringing for
  // all of them at once.
  const prevPendingIdsForStationRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const prevIds = prevPendingIdsForStationRef.current;
    if (prevIds) {
      const hasNewOrder = [...pendingOrderIdsForStation].some((id) => !prevIds.has(id));
      if (hasNewOrder) {
        try {
          const audio = new Audio('/sounds/new-order.wav');
          audio.play().catch(() => { /* user interaction required */ });
        } catch { /* ignore */ }
      }
    }
    prevPendingIdsForStationRef.current = pendingOrderIdsForStation;
  }, [pendingOrderIdsForStation]);

  const updateOrderStatus = (orderId: number | string, newStatus: string) => {
    if (!isOnline) {
      alert('Koneksi terputus — data yang ditampilkan mungkin basi, aksi dinonaktifkan sampai online kembali.');
      return;
    }
    console.log(`[KdsView - ${type}] updateOrderStatus called for ID: ${orderId}, target newStatus: ${newStatus}`);
    updateStatusMutation.mutate({
      orderId, 
      status: newStatus,
      stationType: type
    }, {
      onError: (error: any) => {
        alert(`Gagal: ${error.message}`);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-400">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm">Memuat pesanan...</p>
      </div>
    );
  }

  const stationItemLabel = type === 'barista' ? 'minuman' : 'makanan';

  const renderOrderCard = (order: any) => {
    const orderKey = String(order.id);
    const isCompleting = updateStatusMutation.isPending && String(updateStatusMutation.variables?.orderId) === orderKey;
    const isPrinting = printingOrderId === orderKey;
    const printMessage = printStatusByOrderId[orderKey];

    return (
      <article key={order.id} className="flex flex-col rounded-2xl border border-white/10 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-jetbrains-mono)] font-extrabold text-3xl leading-none text-white tabular-nums">
              #{String(order.queueNumber).padStart(3, '0')}
            </p>
            {order.customerName && (
              <p className="mt-2 truncate text-base font-semibold text-zinc-200">{order.customerName}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-medium text-zinc-300 tabular-nums">
              {formatClock(new Date(order.createdAt))}
            </p>
            {order.orderNo && (
              <p className="mt-1 max-w-[9rem] truncate font-mono text-xs text-zinc-500">{order.orderNo}</p>
            )}
          </div>
        </div>

        <ul className="mt-4 flex-1 divide-y divide-white/5 border-y border-white/5">
          {order.items.map((item: any) => {
            const notesParts = (item.notes || '').split(',').map((n: string) => n.trim()).filter(Boolean);
            return (
              <li key={item.id} className="py-3">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-[family-name:var(--font-jetbrains-mono)] font-extrabold text-base text-white tabular-nums">{item.quantity}x</span>
                  <span className="flex-1 text-base font-semibold leading-snug text-white">{item.menuItem?.name}</span>
                  {item.size && item.size !== '-' && <Badge variant="surface">{item.size}</Badge>}
                </div>
                {notesParts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {notesParts.map((note: string, i: number) => (
                      <Badge key={i} variant="surface" className="text-[13px]">
                        {note.replace(/^(size|sugarLevel|iceLevel|sugar|ice):\s*/i, (_, key) => `${key}: `)}
                      </Badge>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex gap-2">
          <Button
            variant="brand"
            size="lg"
            className="flex-1"
            onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
            disabled={!isOnline || isCompleting}
          >
            {isCompleting ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            {isCompleting ? 'Menyimpan...' : 'Complete'}
          </Button>
          {onPrintLabel && (
            <Button
              variant="surface"
              size="lg"
              onClick={() => handlePrintLabel(orderKey)}
              disabled={!printerConnected || isPrinting}
              title={printerConnected ? 'Cetak ulang label order ini' : 'Hubungkan printer dulu'}
            >
              {isPrinting ? <Loader2 className="animate-spin" aria-hidden /> : <Printer aria-hidden />}
              {isPrinting ? 'Mencetak' : 'Label'}
            </Button>
          )}
        </div>
        {onPrintLabel && printMessage && (
          <p className={cn('mt-2 text-right text-xs', printMessage.startsWith('Gagal') ? 'text-red-300' : 'text-zinc-400')}>
            {printMessage}
          </p>
        )}
      </article>
    );
  };

  const closeSearch = () => {
    setSearchQuery('');
    setShowSearch(false);
  };

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 selection:bg-primary/40">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold text-white">{title}</h1>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
                    isOnline ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', isOnline ? 'bg-emerald-400' : 'bg-red-400')} aria-hidden />
                  {isOnline ? 'Live' : 'Offline'}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-zinc-400">
                {activeOrders.length} pesanan aktif
              </p>
            </div>
            <time className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] font-extrabold text-2xl text-white tabular-nums">{formatClock(now)}</time>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="min-w-0 flex-1">{headerExtra}</div>
            <Button
              variant={showSearch ? 'brand' : 'surface'}
              size="icon"
              aria-label={showSearch ? 'Tutup pencarian' : 'Cari pesanan'}
              aria-pressed={showSearch}
              onClick={() => (showSearch ? closeSearch() : setShowSearch(true))}
            >
              {showSearch ? <X aria-hidden /> : <Search aria-hidden />}
            </Button>
            <Button
              variant="surface"
              size="icon"
              aria-label="Muat ulang pesanan"
              onClick={() => fetchOrders()}
              disabled={refreshing}
            >
              <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden />
            </Button>
          </div>

          {showSearch && (
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
              <Input
                autoFocus
                type="search"
                inputMode="search"
                placeholder="No. antrian, nama, atau menu"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-xl border-white/10 bg-zinc-900 pl-9 text-base text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>
          )}
        </div>
      </header>

      {!isOnline && (
        <div role="status" className="border-b border-red-500/20 bg-red-500/10 px-4 py-2.5">
          <p className="mx-auto flex max-w-6xl items-start gap-2 text-sm text-red-200">
            <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Koneksi terputus. Menampilkan data terakhir
              {lastSyncedAt ? ` jam ${formatClock(new Date(lastSyncedAt))}` : ''}. Tombol Complete nonaktif sampai online lagi.
            </span>
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        {activeOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
            <Inbox className="size-10 text-zinc-600" aria-hidden />
            {searchQuery ? (
              <>
                <p className="mt-4 text-base font-semibold text-zinc-300">Nggak ada pesanan yang cocok</p>
                <p className="mt-1 text-sm text-zinc-500">Coba kata kunci lain, atau tutup pencarian.</p>
              </>
            ) : (
              <>
                <p className="mt-4 text-base font-semibold text-zinc-300">Belum ada pesanan</p>
                <p className="mt-1 text-sm text-zinc-500">Pesanan {stationItemLabel} baru muncul otomatis di sini.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeOrders.map(renderOrderCard)}
          </div>
        )}
      </main>
    </div>
  );
}
