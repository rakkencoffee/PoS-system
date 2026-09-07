'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCartStore } from '@/stores/useCartStore';
import { getKioskDeviceId } from '@/lib/kiosk-device';

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
  const clearCart = useCartStore((state) => state.clearCart);

  // Capture ?device=A/B/C once so it survives client-side navigation to
  // routes (like /checkout) that don't carry the query string — this is what
  // lets the EDC job land on this device's own physical terminal instead of
  // whichever of the 3 daemons happens to poll first.
  useEffect(() => {
    getKioskDeviceId();
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
    </>
  );
}
