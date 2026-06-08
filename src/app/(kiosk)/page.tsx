'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function WelcomePage() {
  const router = useRouter();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 cursor-pointer select-none"
      onClick={() => router.push('/menu-new')}
    >
      {/* Main content - Only CTA Button visible for now */}
      <div className="text-center max-w-xl">
        {/* CTA */}
        <div className="animate-fade-in-up delay-1">
          <div className="inline-flex flex-col items-center gap-4">
            {/* <button className="btn-primary text-xl px-16 py-5 rounded-2xl animate-pulse-glow shadow-xl">
              Tap to Order
            </button> */}
            <span className="text-(--text-secondary) font-medium text-sm tracking-widest uppercase bg-white/40 px-4 py-1 rounded-full backdrop-blur-sm">
              Touch anywhere to start
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
