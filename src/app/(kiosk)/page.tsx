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
          </div>
        </div>
      </div>
    </div>
  );
}
