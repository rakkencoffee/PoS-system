'use client';

import { useEffect } from 'react';
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#0a0a0a]">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl mb-4">☕</div>
        <h1 className="text-3xl font-black text-white tracking-tight">SIBUK MENYEDUH...</h1>
        <p className="text-zinc-400 text-base leading-relaxed">
          Terjadi kendala teknis saat memproses halaman ini. Mohon maaf atas ketidaknyamanannya.
        </p>
        <div className="pt-4 flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full py-4 rounded-2xl bg-[#A8131E] text-white font-bold shadow-xl shadow-[#A8131E]/20 active:scale-95 transition-all"
          >
            Coba Segarkan Halaman
          </button>
          <a
            href="/"
            className="w-full py-4 rounded-2xl bg-white/5 text-zinc-300 font-medium border border-white/10"
          >
            Kembali ke Awal
          </a>
        </div>
        <div className="pt-10">
          <p className="text-[10px] text-zinc-700 uppercase tracking-[0.2em]">
            SYSTEM_ERROR_LOGGED_SENTRY
          </p>
        </div>
      </div>
    </div>
  );
}
