'use client';

import { useEffect } from 'react';
import { useKitchenOrders, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useQueryClient } from '@tanstack/react-query';
import { OrderData } from '@/lib/types';

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading: loading, refetch: fetchOrders, isFetching: refreshing } = useKitchenOrders();
  const updateStatusMutation = useUpdateOrderStatus();

  // Listen for Pusher real-time updates + Network Reconnect (Sprint 3)
  useEffect(() => {
    let channel: any = null;

    async function connectPusher() {
      const { getPusherClient } = await import('@/lib/pusher');
      const pusher = getPusherClient();
      channel = pusher.subscribe('kitchen');

      channel.bind('ORDER_CREATED', (data: { order: any }) => {
        console.log('[Pusher] New order received:', data.order);
        queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen'] });

        try {
          const audio = new Audio('/sounds/new-order.wav');
          audio.play().catch(() => { /* user interaction required */ });
        } catch { /* ignore */ }
      });

      channel.bind('ORDER_UPDATED', (data: { order: any }) => {
        queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen'] });
      });

      // Refetch when Pusher reconnects (Sprint 3)
      pusher.connection.bind('state_change', (states: any) => {
        if (states.current === 'connected') {
          console.log('[Pusher] Connected/Reconnected, refetching...');
          queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen'] });
        }
      });
    }

    // Auto-refresh when internet is back (Sprint 3)
    const handleOnline = () => {
      console.log('[Kitchen] Back online, refetching...');
      queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen'] });
    };

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

  const updateOrderStatus = async (orderId: number | string, newStatus: string) => {
    try {
      await updateStatusMutation.mutateAsync({ orderId, status: newStatus });
    } catch (error: any) {
      console.error('Error updating order:', error);
      alert(`Gagal: ${error.message}`);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: 'from-yellow-500 to-amber-500',
    PREPARING: 'from-blue-500 to-cyan-500',
  };

  const statusBg: Record<string, string> = {
    PENDING: 'border-yellow-500/30 bg-yellow-500/5',
    PREPARING: 'border-blue-500/30 bg-blue-500/5',
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  // ═══ SORTING: Coffee orders selalu di atas ═══
  const coffeeOrders = orders.filter((o: any) => o.isCoffeeOrder);
  const foodOrders = orders.filter((o: any) => !o.isCoffeeOrder);

  const coffeeOrdersPending = coffeeOrders.filter((o: any) => o.status === 'PENDING');
  const coffeeOrdersPreparing = coffeeOrders.filter((o: any) => o.status === 'PREPARING');
  const foodOrdersPending = foodOrders.filter((o: any) => o.status === 'PENDING');
  const foodOrdersPreparing = foodOrders.filter((o: any) => o.status === 'PREPARING');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#A8131E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-(--text-muted)">Loading orders...</p>
        </div>
      </div>
    );
  }

  const renderOrderCard = (order: OrderData & { _isCoffee?: boolean }) => (
    <div
      key={order.id}
      className={`rounded-2xl border-2 p-5 transition-all animate-fade-in ${
        order._isCoffee
          ? 'border-amber-500/40 bg-amber-500/5'
          : statusBg[order.status] || ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-black bg-linear-to-r ${statusColors[order.status]} bg-clip-text text-transparent`}>
            #{order.queueNumber}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`badge text-[10px] ${
                order.status === 'PENDING' ? 'badge-status-pending' : 'badge-status-preparing'
              }`}>
                {order.status}
              </span>
              {order._isCoffee && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  ☕ COFFEE
                </span>
              )}
            </div>
            <p className="text-xs text-(--text-muted) mt-0.5">{formatTime(order.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        {order.items.map((item) => (
          <div key={item.id} className="bg-black/20 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-(--text-primary) text-sm">
                {item.quantity}x {item.menuItem?.name || 'Unknown Item'}
              </span>
              <span className="text-xs text-(--text-muted) bg-white/10 px-2 py-0.5 rounded-full">
                {item.size}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.sugarLevel !== 'normal' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                  Sugar {item.sugarLevel}
                </span>
              )}
              {item.iceLevel !== 'none' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                  Ice: {item.iceLevel}
                </span>
              )}
              {item.extraShot && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#A8131E]/30 text-red-200">
                  +Shot
                </span>
              )}
              {item.toppings?.map((t, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                  {t.topping?.name || 'Extra'}
                </span>
              ))}
            </div>
            {item.notes && (
              <p className="text-[10px] text-amber-400 mt-1">📝 {item.notes}</p>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {order.status === 'PENDING' && (
          <button
            onClick={() => updateOrderStatus(order.id, 'PREPARING')}
            disabled={updateStatusMutation.isPending && updateStatusMutation.variables?.orderId === order.id}
            className="flex-1 py-3 rounded-xl bg-linear-to-r from-blue-500 to-cyan-500 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 disabled:opacity-50"
          >
            {updateStatusMutation.isPending && updateStatusMutation.variables?.orderId === order.id ? '...' : '👨‍🍳 Start Making'}
          </button>
        )}
        {order.status === 'PREPARING' && (
          <button
            onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
            disabled={updateStatusMutation.isPending && updateStatusMutation.variables?.orderId === order.id}
            className="flex-1 py-3 rounded-xl bg-linear-to-r from-green-500 to-emerald-500 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-green-500/25 active:scale-95 disabled:opacity-50"
          >
            {updateStatusMutation.isPending && updateStatusMutation.variables?.orderId === order.id ? '...' : '🎉 Complete Order'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gradient">Kitchen Display</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                <div className={`w-1.5 h-1.5 rounded-full ${typeof window !== 'undefined' && navigator.onLine ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">
                  {typeof window !== 'undefined' && navigator.onLine ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
            <p className="text-(--text-muted) text-sm mt-1">
              {orders.length} active orders
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchOrders()}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Syncing...' : 'Sync Data'}
            </button>
            <div className="text-right">
              <p className="text-xl font-semibold text-(--text-primary)">
                {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2-column layout */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <span className="text-7xl mb-6">🍵</span>
          <h2 className="text-2xl font-bold text-(--text-primary) mb-2">No Active Orders</h2>
          <p className="text-(--text-muted)">Waiting for new orders...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ═══ COFFEE SECTION ═══ */}
          {(coffeeOrdersPending.length > 0 || coffeeOrdersPreparing.length > 0) && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-900/40 border border-amber-500/30">
                  <span className="text-2xl">☕</span>
                  <h2 className="text-lg font-bold text-amber-300 uppercase tracking-wide">Barista Station — Coffee & Drinks</h2>
                </div>
                <div className="flex-1 h-px bg-amber-500/20" />
                <span className="text-sm text-amber-400/60 font-medium">{coffeeOrdersPending.length + coffeeOrdersPreparing.length} orders</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coffee Pending */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
                    <h3 className="text-base font-semibold text-yellow-400">
                      Pending ({coffeeOrdersPending.length})
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {coffeeOrdersPending.map((o: any) => renderOrderCard({ ...o, _isCoffee: true }))}
                    {coffeeOrdersPending.length === 0 && (
                      <p className="text-sm text-zinc-500 italic">No pending coffee orders</p>
                    )}
                  </div>
                </div>

                {/* Coffee Preparing */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                    <h3 className="text-base font-semibold text-blue-400">
                      Preparing ({coffeeOrdersPreparing.length})
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {coffeeOrdersPreparing.map((o: any) => renderOrderCard({ ...o, _isCoffee: true }))}
                    {coffeeOrdersPreparing.length === 0 && (
                      <p className="text-sm text-zinc-500 italic">No coffee being prepared</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ DIVIDER ═══ */}
          {(coffeeOrdersPending.length > 0 || coffeeOrdersPreparing.length > 0) && 
           (foodOrdersPending.length > 0 || foodOrdersPreparing.length > 0) && (
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-800 border border-zinc-700">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">▼ Food & Snacks Below ▼</span>
              </div>
              <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
            </div>
          )}

          {/* ═══ FOOD / NON-COFFEE SECTION ═══ */}
          {(foodOrdersPending.length > 0 || foodOrdersPreparing.length > 0) && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-900/40 border border-emerald-500/30">
                  <span className="text-2xl">🍽️</span>
                  <h2 className="text-lg font-bold text-emerald-300 uppercase tracking-wide">Kitchen Station — Food & Snacks</h2>
                </div>
                <div className="flex-1 h-px bg-emerald-500/20" />
                <span className="text-sm text-emerald-400/60 font-medium">{foodOrdersPending.length + foodOrdersPreparing.length} orders</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Food Pending */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
                    <h3 className="text-base font-semibold text-yellow-400">
                      Pending ({foodOrdersPending.length})
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {foodOrdersPending.map((o: any) => renderOrderCard({ ...o, _isCoffee: false }))}
                    {foodOrdersPending.length === 0 && (
                      <p className="text-sm text-zinc-500 italic">No pending food orders</p>
                    )}
                  </div>
                </div>

                {/* Food Preparing */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                    <h3 className="text-base font-semibold text-blue-400">
                      Preparing ({foodOrdersPreparing.length})
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {foodOrdersPreparing.map((o: any) => renderOrderCard({ ...o, _isCoffee: false }))}
                    {foodOrdersPreparing.length === 0 && (
                      <p className="text-sm text-zinc-500 italic">No food being prepared</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
