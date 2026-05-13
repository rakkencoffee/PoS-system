'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard';
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Username atau password salah');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError('Terjadi kesalahan sistem');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/20 blur-3xl rounded-full" />
      
      <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm animate-shake">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]/20 focus:border-[var(--brand-500)] transition-all"
            placeholder="Masukkan username"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]/20 focus:border-[var(--brand-500)] transition-all"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn-primary py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Sign In'
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-image">
      {/* Background Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10" />

      <div className="w-full max-w-md animate-fade-in-up">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-block mb-4 animate-float">
            <span className="text-6xl drop-shadow-2xl" role="img" aria-label="coffee">☕</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-[var(--brand-500)]">StartFriday</span>
            <span className="text-gray-500 font-medium block text-xl mt-1 uppercase tracking-widest">Staff Portal</span>
          </h1>
        </div>

        {/* Login Form with Suspense */}
        <Suspense fallback={
          <div className="glass-card p-12 flex flex-col items-center justify-center gap-4">
             <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
             <p className="text-white/40 text-sm">Loading portal...</p>
          </div>
        }>
          <LoginForm />
        </Suspense>

        {/* Footer Info */}
        <p className="mt-8 text-center text-gray-400 text-xs font-medium uppercase tracking-widest">
          Rakken Coffee POS v2.0
        </p>
      </div>
    </div>
  );
}
