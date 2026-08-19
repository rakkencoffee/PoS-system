'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OrderData } from '@/lib/types';

function PublicBoard() {
  const [orders, setOrders] = useState<OrderData[]>([]);

  const fetchBoard = useCallback(() => {
    fetch('/api/orders?today=true')
      .then(res => res.json())
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // Realtime refresh via Pusher (no polling): refetch on new/updated orders.
  useEffect(() => {
    let channel: any = null;
    (async () => {
      const { getPusherClient } = await import('@/lib/pusher');
      const pusher = getPusherClient();
      channel = pusher.subscribe('kitchen');
      channel.bind('ORDER_CREATED', fetchBoard);
      channel.bind('ORDER_UPDATED', fetchBoard);
      pusher.connection.bind('state_change', (s: { current: string }) => {
        if (s.current === 'connected') fetchBoard();
      });
    })();
    return () => {
      if (channel) {
        channel.unbind_all();
        channel.unsubscribe();
      }
    };
  }, [fetchBoard]);

  const pending = orders.filter(o => o.status === 'PENDING');
  const preparing = orders.filter(o => o.status === 'PREPARING');
  const ready = orders.filter(o => o.status === 'COMPLETED');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-yellow-400 mb-4">Pending ({pending.length})</h2>
        <div className="space-y-2">
          {pending.map(o => <div key={o.id} className="text-2xl font-mono text-center">#{String(o.queueNumber).padStart(3, '0')}</div>)}
        </div>
      </div>
      <div className="glass-card p-6 border-blue-500/30">
        <h2 className="text-xl font-bold text-blue-400 mb-4">Preparing ({preparing.length})</h2>
        <div className="space-y-2">
          {preparing.map(o => <div key={o.id} className="text-2xl font-mono text-center">#{String(o.queueNumber).padStart(3, '0')}</div>)}
        </div>
      </div>
      <div className="glass-card p-6 border-green-500/30">
        <h2 className="text-xl font-bold text-green-400 mb-4">Ready ({ready.length})</h2>
        <div className="space-y-2">
          {ready.map(o => <div key={o.id} className="text-2xl font-mono text-center text-green-400">#{String(o.queueNumber).padStart(3, '0')}</div>)}
        </div>
      </div>
    </div>
  );
}

function StatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      setError('Order ID missing');
      return;
    }
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error('Order not found');
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setOrder(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching order:', err);
      setError(err.message || 'Failed to fetch order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Realtime updates via Pusher (replaces the dead SSE endpoint + 5s polling).
  // Subscribes to the same `kitchen` channel the KDS and the Olsera webhook
  // broadcast on, then merges updates for THIS order only.
  useEffect(() => {
    if (!orderId) return;
    let channel: any = null;

    (async () => {
      const { getPusherClient } = await import('@/lib/pusher');
      const pusher = getPusherClient();
      channel = pusher.subscribe('kitchen');

      channel.bind('ORDER_UPDATED', (data: { order?: any }) => {
        if (data?.order && String(data.order.id) === orderId) {
          setOrder((prev) =>
            prev
              ? { ...prev, ...data.order, items: data.order.items?.length ? data.order.items : prev.items }
              : data.order
          );
        }
      });

      // On (re)connect, refetch once to catch updates missed while disconnected.
      pusher.connection.bind('state_change', (states: { current: string }) => {
        if (states.current === 'connected') fetchOrder();
      });
    })();

    return () => {
      if (channel) {
        channel.unbind_all();
        channel.unsubscribe();
      }
    };
  }, [orderId, fetchOrder]);

  const statusConfig: Record<string, { label: string; color: string; icon: string; desc: string }> = {
    PENDING: { label: 'Pending', color: 'from-yellow-500 to-amber-500', icon: '⏳', desc: 'Your order is in the queue' },
    PREPARING: { label: 'Preparing', color: 'from-blue-500 to-cyan-500', icon: '👨‍🍳', desc: 'The barista is making your drink' },
    COMPLETED: { label: 'Completed', color: 'from-gray-500 to-gray-600', icon: '🎉', desc: 'Order completed. Thank you!' },
  };

  const steps = ['PENDING', 'PREPARING', 'COMPLETED'];
  const currentStep = steps.indexOf(order?.status || 'PENDING');

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#A8131E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    if (!orderId) {
      // Public Board Mode
      return (
        <div className="min-h-dvh p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gradient mb-8 text-center">Public Status Board</h1>
            <PublicBoard />
          </div>
        </div>
      );
    }
    
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-8 text-center">
        <span className="text-6xl mb-6">🔍</span>
        <h2 className="text-2xl font-bold text-(--text-primary) mb-2">Order Not Found</h2>
        <p className="text-(--text-muted) mb-8 max-w-xs">
          We couldn't find your order details. Please check your order ID or try again.
        </p>
        <button onClick={() => router.push('/menu')} className="btn-primary px-8">
          Go to Menu
        </button>
      </div>
    );
  }

  const status = statusConfig[order.status] || statusConfig.PENDING;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-md w-full">
        {/* Status Icon */}
        <div className="mb-8 animate-scale-in">
          <div className={`w-24 h-24 rounded-full bg-linear-to-r ${status.color} flex items-center justify-center mx-auto shadow-2xl`}>
            <span className="text-4xl">{status.icon}</span>
          </div>
        </div>

        {/* Queue Number */}
        <div className="glass-card p-6 mb-6 animate-fade-in">
          <p className="text-xs text-(--text-muted) uppercase tracking-wider mb-1">Nomor Antrean</p>
          <p className="text-6xl font-black text-gradient mb-2">#{String(order.queueNumber).padStart(3, '0')}</p>
          <p className="text-xs text-(--text-muted) font-mono">ID: {(order as any).orderNo || order.id}</p>
        </div>

        {/* Status */}
        <h2 className="text-2xl font-bold text-(--text-primary) mb-1">{status.label}</h2>
        <p className="text-(--text-muted) mb-8">{status.desc}</p>

        {/* Progress Steps */}
        <div className="glass-card p-6 mb-8 animate-fade-in delay-1" style={{ opacity: 0 }}>
          <div className="flex items-center justify-between relative">
            {/* Progress line */}
            <div className="absolute top-4 left-8 right-8 h-0.5 bg-white/10">
              <div
                className="h-full bg-linear-to-r from-[#A8131E] to-[#c41525] transition-all duration-1000"
                style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
              />
            </div>

            {steps.map((step, index) => {
              const stepStatus = statusConfig[step];
              const isActive = index <= currentStep;
              const isCurrent = index === currentStep;
              return (
                <div key={step} className="relative z-10 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                    isCurrent
                      ? `bg-linear-to-r ${stepStatus.color} text-white shadow-lg animate-pulse`
                      : isActive
                        ? 'bg-[#A8131E] text-white'
                        : 'bg-white/10 text-white/40'
                  }`}>
                    {isActive ? '✓' : index + 1}
                  </div>
                  <span className={`text-[10px] mt-2 ${isActive ? 'text-(--text-secondary)' : 'text-(--text-muted)'}`}>
                    {stepStatus.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Items */}
        <div className="glass-card p-5 mb-6 text-left animate-fade-in delay-2" style={{ opacity: 0 }}>
          <h3 className="text-sm font-semibold text-(--text-secondary) mb-3">Your Order</h3>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-1.5 text-sm">
              <span className="text-(--text-primary)">{item.quantity}x {item.menuItem.name} ({item.size})</span>
            </div>
          ))}
        </div>

        <button onClick={() => router.push('/')} className="btn-ghost w-full">
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#A8131E] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <StatusContent />
    </Suspense>
  );
}
