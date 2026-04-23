'use client';

import { useState } from 'react';

export default function SentryExamplePage() {
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const triggerFrontendError = () => {
    setErrorStatus('Frontend Error Triggered');
    throw new Error('Sentry Frontend Test Error: ' + new Date().toISOString());
  };

  const triggerApiError = async () => {
    setErrorStatus('Calling Broken API...');
    try {
      const res = await fetch('/api/test-sentry');
      if (!res.ok) {
        const data = await res.json();
        setErrorStatus(`API Error: ${data.message || 'Unknown'}`);
      }
    } catch (err) {
      setErrorStatus('API Fetch Failed');
    }
  };

  return (
    <div className="min-h-screen p-8 bg-(--bg-primary) flex flex-col items-center justify-center">
      <div className="glass-card p-10 max-w-lg w-full text-center">
        <h1 className="text-3xl font-bold text-gradient mb-4">Sentry Debug Page</h1>
        <p className="text-(--text-muted) mb-8">
          Halaman ini digunakan untuk memverifikasi bahwa Sentry sudah terhubung dengan benar ke project **Rakken Coffee**.
        </p>

        <div className="space-y-4">
          <button
            onClick={triggerFrontendError}
            className="btn-primary w-full py-4 text-lg font-bold"
          >
            Trigger Frontend Error
          </button>

          <button
            onClick={triggerApiError}
            className="btn-secondary w-full py-4 text-lg font-bold border-[#A8131E]/20"
          >
            Trigger API Error
          </button>
        </div>

        {errorStatus && (
          <div className="mt-8 p-4 rounded-xl bg-black/40 border border-white/5">
            <p className="text-xs font-mono text-amber-400">Status: {errorStatus}</p>
          </div>
        )}

        <div className="mt-10 text-left space-y-4">
          <h3 className="text-sm font-bold text-(--text-secondary) uppercase tracking-widest">Langkah Verifikasi:</h3>
          <ol className="text-sm text-(--text-muted) list-decimal pl-5 space-y-2">
            <li>Klik tombol di atas untuk memicu error.</li>
            <li>Buka dashboard Sentry di <strong>rakken-coffee</strong>.</li>
            <li>Cek bagian <strong>Issues</strong>.</li>
            <li>Jika error muncul, berarti konfigurasi SDK Sentry sudah aktif.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
