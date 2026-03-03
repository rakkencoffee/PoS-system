'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface OrderData {
  id: number;
  queueNumber: number;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: {
    id: number;
    menuItem: { name: string };
    quantity: number;
    size: string;
  }[];
}

function StatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<OrderData | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order:', error);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Listen for SSE updates
  useEffect(() => {
    const eventSource = new EventSource('/api/orders/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ORDER_UPDATED' && data.order?.id === parseInt(orderId || '0')) {
          setOrder(data.order);
        }
      } catch {
        // Ignore parse errors
      }
    };

    return () => eventSource.close();
  }, [orderId]);

  const statusConfig: Record<string, { label: string; color: string; icon: string; desc: string }> = {
    PENDING: { label: 'Pending', color: 'from-yellow-500 to-amber-500', icon: '⏳', desc: 'Your order is in the queue' },
    PREPARING: { label: 'Preparing', color: 'from-blue-500 to-cyan-500', icon: '👨‍🍳', desc: 'The barista is making your drink' },
    READY: { label: 'Ready!', color: 'from-green-500 to-emerald-500', icon: '✅', desc: 'Come pick up your order!' },
    COMPLETED: { label: 'Completed', color: 'from-gray-500 to-gray-600', icon: '🎉', desc: 'Order completed. Thank you!' },
  };

  const steps = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'];
  const currentStep = steps.indexOf(order?.status || 'PENDING');

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-coffee-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const status = statusConfig[order.status] || statusConfig.PENDING;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-md w-full">
        {/* Status Icon */}
        <div className="mb-8 animate-scale-in">
          <div className={`w-24 h-24 rounded-full bg-gradient-to-r ${status.color} flex items-center justify-center mx-auto shadow-2xl`}>
            <span className="text-4xl">{status.icon}</span>
          </div>
        </div>

        {/* Queue Number */}
        <div className="glass-card p-6 mb-6 animate-fade-in">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Queue</p>
          <p className="text-5xl font-black text-gradient">#{order.queueNumber}</p>
        </div>

        {/* Status */}
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{status.label}</h2>
        <p className="text-[var(--text-muted)] mb-8">{status.desc}</p>

        {/* Progress Steps */}
        <div className="glass-card p-6 mb-8 animate-fade-in delay-1" style={{ opacity: 0 }}>
          <div className="flex items-center justify-between relative">
            {/* Progress line */}
            <div className="absolute top-4 left-8 right-8 h-0.5 bg-coffee-800">
              <div
                className="h-full bg-gradient-to-r from-coffee-500 to-amber-500 transition-all duration-1000"
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
                      ? `bg-gradient-to-r ${stepStatus.color} text-white shadow-lg animate-pulse`
                      : isActive
                        ? 'bg-coffee-600 text-white'
                        : 'bg-coffee-800 text-coffee-500'
                  }`}>
                    {isActive ? '✓' : index + 1}
                  </div>
                  <span className={`text-[10px] mt-2 ${isActive ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
                    {stepStatus.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Items */}
        <div className="glass-card p-5 mb-6 text-left animate-fade-in delay-2" style={{ opacity: 0 }}>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Your Order</h3>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-1.5 text-sm">
              <span className="text-[var(--text-primary)]">{item.quantity}x {item.menuItem.name} ({item.size})</span>
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-coffee-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <StatusContent />
    </Suspense>
  );
}
