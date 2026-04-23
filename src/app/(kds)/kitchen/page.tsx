'use client';

import { useEffect } from 'react';
import { useKitchenOrders, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useQueryClient } from '@tanstack/react-query';

// (Simplified OrderData interface if needed, or keep existing)

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading: loading, refetch: fetchOrders, isFetching: refreshing } = useKitchenOrders();
  const updateStatusMutation = useUpdateOrderStatus();

  // Listen for Pusher real-time updates (Sprint 3)
  useEffect(() => {
    let channel: any = null;

    async function connectPusher() {
      const { getPusherClient } = await import('@/lib/pusher');
      const pusher = getPusherClient();
      channel = pusher.subscribe('kitchen');

      channel.bind('ORDER_CREATED', (data: { order: any }) => {
        console.log('[Pusher] New order received:', data.order);
        // Invalidate orders to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen'] });

        // Play chime notification
        try {
          const audio = new Audio('/sounds/new-order.wav');
          audio.play().catch(() => { /* user hasn't interacted yet */ });
        } catch { /* silently fail */ }
      });

      channel.bind('ORDER_UPDATED', (data: { order: any }) => {
        console.log('[Pusher] Order updated:', data.order);
        queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen'] });
      });
    }

    connectPusher();

    return () => {
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

  const pendingOrders = orders.filter((o: any) => o.status === 'PENDING');
  const preparingOrders = orders.filter((o: any) => o.status === 'PREPARING');

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

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

  const renderOrderCard = (order: OrderData) => (
    <div
      key={order.id}
      className={`rounded-2xl border-2 p-5 transition-all animate-fade-in ${statusBg[order.status] || ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-black bg-linear-to-r ${statusColors[order.status]} bg-clip-text text-transparent`}>
            #{order.queueNumber}
          </span>
          <div>
            <span className={`badge text-[10px] ${
              order.status === 'PENDING' ? 'badge-status-pending' : 'badge-status-preparing'
            }`}>
              {order.status}
            </span>
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
            <h1 className="text-3xl font-bold text-gradient">Kitchen Display</h1>
            <p className="text-(--text-muted) text-sm mt-1">
              {orders.length} active orders
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchOrders}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pending */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
              <h2 className="text-lg font-semibold text-yellow-400">
                Pending ({pendingOrders.length})
              </h2>
            </div>
            <div className="space-y-4">
              {pendingOrders.map(renderOrderCard)}
            </div>
          </div>

          {/* Preparing */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
              <h2 className="text-lg font-semibold text-blue-400">
                Preparing ({preparingOrders.length})
              </h2>
            </div>
            <div className="space-y-4">
              {preparingOrders.map(renderOrderCard)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
