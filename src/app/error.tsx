'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

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
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#A8131E]/5">
      <div className="max-w-md w-full glass p-8 rounded-3xl shadow-2xl border border-[#A8131E]/20 text-center animate-fade-in">
        <div className="w-20 h-20 bg-[#A8131E]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">⚠️</span>
        </div>
        
        <h2 className="text-2xl font-bold text-(--text-primary) mb-3">
          Terjadi Kesalahan
        </h2>
        
        <p className="text-(--text-muted) mb-8 text-sm leading-relaxed">
          Mohon maaf atas ketidaknyamanan ini. Sistem kami telah mencatat masalah ini secara otomatis untuk segera kami perbaiki.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="btn-primary w-full py-3 font-semibold shadow-lg hover:shadow-[#A8131E]/20 transition-all active:scale-95"
          >
            Coba Lagi
          </button>
          
          <button
            onClick={() => window.location.href = '/menu'}
            className="btn-secondary w-full py-3 font-semibold transition-all active:scale-95"
          >
            Kembali ke Menu
          </button>
        </div>
        
        {error.digest && (
          <p className="mt-6 text-[10px] text-(--text-muted) font-mono opacity-50">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
