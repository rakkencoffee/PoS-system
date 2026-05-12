'use client';

import { useState, useEffect } from 'react';

interface KdsAuthProps {
  children: React.ReactNode;
  title: string;
}

export function KdsAuth({ children, title }: KdsAuthProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Check session storage on mount
  useEffect(() => {
    const auth = sessionStorage.getItem('kds_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple password check (can be moved to env/server later)
    // For now using 'rakken123' as requested/default
    const correctPassword = process.env.NEXT_PUBLIC_KDS_PASSWORD || 'rakken123';
    
    if (password === correctPassword) {
      setIsAuthenticated(true);
      sessionStorage.setItem('kds_auth', 'true');
    } else {
      setError('Password salah. Silakan coba lagi.');
      setPassword('');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F] p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#A8131E]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#A8131E]/20">
            <span className="text-4xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
          <p className="text-zinc-400 text-sm">Masukkan password untuk mengakses KDS</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#A8131E] transition-all text-center text-xl tracking-widest"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-[#A8131E] text-white font-bold text-lg hover:bg-[#8B1019] active:scale-95 transition-all shadow-lg shadow-[#A8131E]/20"
          >
            Akses KDS
          </button>
        </form>
        
        <p className="text-center text-zinc-600 text-[10px] mt-8 uppercase tracking-widest">
          Rakken Coffee — Kitchen Display System
        </p>
      </div>
    </div>
  );
}
