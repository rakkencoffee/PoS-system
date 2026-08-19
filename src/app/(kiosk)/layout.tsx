'use client';

import { usePathname } from 'next/navigation';

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  return (
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
  );
}
