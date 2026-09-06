'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { captureStationFromUrl, getStation } from '@/lib/station';
import { useCartStore } from '@/stores/useCartStore';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const IDLE_EVENTS = ['pointerdown', 'touchstart', 'keydown'] as const;

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLandingPage = pathname === '/';
  const [station, setStation] = useState<string | null>(null);
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    captureStationFromUrl();
    setStation(getStation());
  }, []);

  // Return an idle customer to the welcome screen so the next customer never
  // inherits an abandoned cart. Skipped on /checkout — an EDC transaction can
  // sit waiting on the physical terminal for a while with zero screen touches,
  // and navigating away mid-payment would abandon it.
  useEffect(() => {
    if (isLandingPage || pathname === '/checkout') return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        clearCart();
        router.push('/');
      }, IDLE_TIMEOUT_MS);
    };

    IDLE_EVENTS.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      IDLE_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [pathname, isLandingPage, clearCart, router]);

  return (
    <>
      <link rel="preload" href="/api/menu" as="fetch" fetchPriority="low" />
      <link rel="preload" href="https://api-dash.olsera.co.id/img/no_data_item.png" as="image" fetchPriority="high" />
      <div
        className="min-h-dvh relative"
        style={{
          backgroundImage: isLandingPage ? "url('/images/landing.webp')" : "url('/images/bg-putih.webp')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="relative z-10">
          {children}
        </div>
      </div>

      {/* Tiny always-visible station indicator — the only way to check this on
          an iOS home-screen shortcut, since apple-mobile-web-app-capable hides
          the address bar (and the ?station= param along with it). */}
      {!isLandingPage && (
        <div
          className="fixed bottom-2 left-2 z-[100] px-2 py-0.5 rounded-md text-[10px] font-mono pointer-events-none select-none"
          style={{
            background: station ? 'rgba(0,0,0,0.35)' : 'rgba(186,26,26,0.85)',
            color: '#fff',
          }}
        >
          {station ? `Station ${station}` : 'No Station'}
        </div>
      )}
    </>
  );
}
