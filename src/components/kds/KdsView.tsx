'use client';

import { useEffect, useState, useMemo } from 'react';
import { useKitchenOrders, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useQueryClient } from '@tanstack/react-query';
import { OrderData } from '@/lib/types';

interface KdsViewProps {
  type: 'kitchen' | 'barista';
  title: string;
}

export function KdsView({ type, title }: KdsViewProps) {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading: loading, refetch: fetchOrders, isFetching: refreshing } = useKitchenOrders();
  const updateStatusMutation = useUpdateOrderStatus();
  
  const [searchQuery, setSearchQuery] = useState('');

  // Listen for Pusher real-time updates
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
        console.log('[Pusher] Order updated received:', data.order);
        if (data.order) {
          queryClient.setQueryData(['orders', 'kitchen'], (oldOrders: any[] | undefined) => {
            if (!oldOrders) return [];
            return oldOrders.map(order => 
              order.id === data.order.id ? { ...order, ...data.order } : order
            );
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
        const isCoffee = ['rakken-signature', 'rakken-style'].includes(item.categorySlug);
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

  const ordersPending = filteredOrders.filter((o: any) => {
    const currentStatus = type === 'barista' ? o.baristaStatus : o.kitchenStatus;
    return (currentStatus || o.status) === 'PENDING';
  });
  
  const ordersPreparing = filteredOrders.filter((o: any) => {
    const currentStatus = type === 'barista' ? o.baristaStatus : o.kitchenStatus;
    return (currentStatus || o.status) === 'PREPARING';
  });

  const updateOrderStatus = (orderId: number | string, newStatus: string) => {
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
      <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#A8131E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading orders...</p>
        </div>
      </div>
    );
  }

  const renderOrderCard = (order: any) => {
    const currentStatus = type === 'barista' ? order.baristaStatus : order.kitchenStatus;
    const displayStatus = currentStatus || order.status;

    return (
      <div key={order.id} className={`rounded-2xl border-2 p-5 transition-all bg-zinc-900/50 ${displayStatus === 'PENDING' ? 'border-yellow-500/20' : 'border-blue-500/20'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div>
              <span className={`text-3xl font-black ${displayStatus === 'PENDING' ? 'text-yellow-500' : 'text-blue-500'}`}>
                #{String(order.queueNumber).padStart(3, '0')}
              </span>
              <div className="text-xs font-mono text-zinc-500 mt-1">
                {order.orderNo || order.id}
              </div>
            </div>
            <div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${displayStatus === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-500'}`}>
                {displayStatus}
              </span>
              <p className="text-[10px] text-zinc-500 mt-0.5">{new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        </div>
        {/* Customer Name */}
        {order.customerName && (
          <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-xs text-amber-400 font-bold flex items-center gap-1.5">
              <span>👤</span> {order.customerName}
            </p>
          </div>
        )}

        <div className="space-y-2 mb-4">
          {order.items.map((item: any) => {
            // Parse notes into structured display
            const notesParts = (item.notes || '').split(',').map((n: string) => n.trim()).filter(Boolean);
            const hasNotes = notesParts.length > 0;
            
            return (
              <div key={item.id} className="bg-black/20 rounded-xl p-3 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-sm">
                    {item.quantity}x {item.menuItem?.name}
                  </span>
                  {item.size && item.size !== '-' && (
                    <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full font-medium">
                      {item.size}
                    </span>
                  )}
                </div>
                {hasNotes && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {notesParts.map((note: string, i: number) => {
                      // Determine badge color based on note type
                      let badgeColor = 'bg-zinc-700/50 text-zinc-300';
                      const lower = note.toLowerCase();
                      if (lower.includes('size') || lower.includes('hot') || lower.includes('ice') || lower.includes('cold')) {
                        badgeColor = 'bg-cyan-500/15 text-cyan-400';
                      } else if (lower.includes('sugar')) {
                        badgeColor = 'bg-amber-500/15 text-amber-400';
                      } else if (lower.includes('icelevel') || lower.includes('ice level')) {
                        badgeColor = 'bg-blue-500/15 text-blue-400';
                      }
                      return (
                        <span key={i} className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${badgeColor}`}>
                          {note.replace(/^(size|sugarLevel|iceLevel|sugar|ice):\s*/i, (_, key) => `${key}: `)}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          {displayStatus === 'PENDING' ? (
            <button
              onClick={() => updateOrderStatus(order.id, 'PREPARING')}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 active:scale-95 transition-all"
            >
              👨‍🍳 Start Making
            </button>
          ) : (
            <button
              onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
              className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-500 active:scale-95 transition-all"
            >
              🎉 Complete
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white p-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-white uppercase">{title}</h1>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Live</span>
              </div>
            </div>
            <p className="text-zinc-500 text-sm mt-1 font-medium">{filteredOrders.length} active orders filtered</p>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Cari Pesanan atau Menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3.5 pl-12 text-sm focus:outline-none focus:border-[#A8131E] transition-all placeholder:text-zinc-600"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchOrders()}
              disabled={refreshing}
              className="px-5 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Syncing' : 'Sync Data'}
            </button>
            <div className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-2xl">
              <p className="text-lg font-black tabular-nums">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-[3rem]">
            <span className="text-7xl mb-6 grayscale opacity-20">🍵</span>
            <h2 className="text-2xl font-bold text-zinc-500 mb-2">No Active Orders</h2>
            <p className="text-zinc-600">Waiting for {type === 'barista' ? 'coffee' : 'kitchen'} items...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pending Column */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black uppercase tracking-widest text-yellow-500 flex items-center gap-3">
                  <div className="w-2 h-8 bg-yellow-500 rounded-full" />
                  Pending
                  <span className="bg-yellow-500/10 px-3 py-1 rounded-full text-xs">{ordersPending.length}</span>
                </h3>
              </div>
              <div className="space-y-6">
                {ordersPending.map(renderOrderCard)}
              </div>
            </div>

            {/* Preparing Column */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black uppercase tracking-widest text-blue-500 flex items-center gap-3">
                  <div className="w-2 h-8 bg-blue-500 rounded-full" />
                  Preparing
                  <span className="bg-blue-500/10 px-3 py-1 rounded-full text-xs">{ordersPreparing.length}</span>
                </h3>
              </div>
              <div className="space-y-6">
                {ordersPreparing.map(renderOrderCard)}
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
