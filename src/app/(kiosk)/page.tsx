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
      onClick={() => router.push('/menu')}
    >
      {/* Time display */}
      <div className="absolute top-8 right-8 text-right animate-fade-in">
        <p className="text-4xl font-light text-white tracking-wider">
          {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-sm text-white/60 mt-1">
          {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Main content */}
      <div className="text-center max-w-xl">
        {/* Animated coffee icon */}
        <div className="mb-8 animate-float">
          <div className="relative inline-block">
            <span className="text-8xl drop-shadow-2xl" role="img" aria-label="coffee">☕</span>
            <div className="absolute -inset-4 rounded-full bg-red-500/15 blur-2xl animate-pulse-glow" />
          </div>
        </div>

        {/* Brand */}
        <h1 className="text-5xl md:text-6xl font-bold mb-4 animate-fade-in-up">
          <span className="text-gradient">StartFriday</span>
          <br />
          <span className="text-white/90 font-light text-3xl md:text-4xl">Coffee</span>
        </h1>

        <p className="text-white/60 text-lg mb-12 animate-fade-in delay-2">
          Freshly brewed, just for you
        </p>

        {/* CTA */}
        <div className="animate-fade-in-up delay-3">
          <div className="inline-flex flex-col items-center gap-4">
            <button className="btn-primary text-xl px-16 py-5 rounded-2xl animate-pulse-glow">
              Tap to Order
            </button>
            <span className="text-white/40 text-sm tracking-widest uppercase">
              Touch anywhere to start
            </span>
          </div>
        </div>
      </div>

      {/* Bottom decoration */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 text-white/40 text-sm animate-fade-in delay-5">
        <div className="w-8 h-px bg-white/30" />
        <span>Self-Service Kiosk</span>
        <div className="w-8 h-px bg-white/30" />
      </div>
    </div>
  );
}
