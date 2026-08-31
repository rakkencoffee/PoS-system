'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { captureStationFromUrl, getStation } from '@/lib/station';

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';
  const [station, setStation] = useState<string | null>(null);

  useEffect(() => {
    captureStationFromUrl();
    setStation(getStation());
  }, []);

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
