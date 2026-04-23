'use client';

import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/useCartStore';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CartSummary() {
  const router = useRouter();
  const { itemCount, totalAmount } = useCartStore();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.push('/cart')}
          className="w-full btn-primary flex items-center justify-between py-4 px-6 rounded-2xl shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
              {itemCount}
            </span>
            <span className="font-semibold">View Cart</span>
          </div>
          <span className="font-bold text-lg">{formatCurrency(totalAmount)}</span>
        </button>
      </div>
    </div>
  );
}
