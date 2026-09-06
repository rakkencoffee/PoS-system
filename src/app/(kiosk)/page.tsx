'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCartStore } from '@/stores/useCartStore';

export default function WelcomePage() {
  const router = useRouter();
  const [time, setTime] = useState(new Date());
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleStart = () => {
    clearCart();
    router.push('/menu');
  };

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center p-8 cursor-pointer select-none"
      onClick={handleStart}
    >
      {/* Main content - Only CTA Button visible for now */}
      <div className="text-center max-w-xl">
        {/* CTA */}
        <div className="animate-fade-in-up delay-1">
          <div className="inline-flex flex-col items-center gap-4">
          </div>
        </div>
      </div>
    </div>
  );
}
