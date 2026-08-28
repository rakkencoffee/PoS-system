'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { captureStationFromUrl } from '@/lib/station';

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  useEffect(() => {
    captureStationFromUrl();
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
    </>
  );
}
