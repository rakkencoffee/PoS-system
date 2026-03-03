'use client';

import { CartProvider } from '@/context/CartContext';

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-gradient-coffee">
        {/* Decorative background elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-linear-to-br from-amber-900/10 to-transparent blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-linear-to-tr from-amber-900/10 to-transparent blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-radial from-coffee-900/5 to-transparent blur-3xl" />
        </div>
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </CartProvider>
  );
}
