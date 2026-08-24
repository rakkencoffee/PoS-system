'use client';

import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

const ALLOWED_ROLES = ['KITCHEN', 'ADMIN'];

export function KdsAuthGate({ children, station }: { children: React.ReactNode; station: 'Kitchen' | 'Barista' }) {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (status === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#0F0F0F]">
        <div className="w-10 h-10 border-4 border-[#A8131E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const role = (session?.user as any)?.role;

  if (status === 'authenticated' && ALLOWED_ROLES.includes(role)) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await signIn('credentials', { username, password, redirect: false });

    if (result?.error) {
      setError('Username atau password salah');
    }
    setIsLoading(false);
  };

  const isWrongRole = status === 'authenticated' && !ALLOWED_ROLES.includes(role);

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-[#0F0F0F]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/rakken-icon.svg" alt="Rakken Coffee" className="h-14 w-14 object-contain mx-auto drop-shadow-2xl" />
          <h1 className="text-2xl font-black tracking-tight text-white mt-4">
            <span className="text-[#A8131E]">RAKKEN</span> {station}
          </h1>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8">
          {isWrongRole ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-zinc-400">
                Akun <span className="font-bold text-white">{session?.user?.name}</span> tidak punya akses ke halaman ini.
              </p>
              <button
                onClick={() => signOut({ redirect: false })}
                className="w-full py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-all"
              >
                Login sebagai user lain
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#A8131E] transition-all"
                  placeholder="Masukkan username"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#A8131E] transition-all"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-[#A8131E] text-white font-bold text-sm hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
