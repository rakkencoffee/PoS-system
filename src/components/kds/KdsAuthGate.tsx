'use client';

import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const darkInput = 'h-12 rounded-xl border-white/10 bg-zinc-950 text-base text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30';

const ALLOWED_ROLES = ['KITCHEN', 'ADMIN'];

export function KdsAuthGate({ children, station }: { children: React.ReactNode; station: 'Kitchen' | 'Barista' }) {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950">
        <Loader2 className="size-8 animate-spin text-primary" aria-label="Memuat" />
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
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/rakken-icon.svg" alt="Rakken Coffee" className="mx-auto size-14 object-contain" />
          <h1 className="mt-4 text-2xl font-bold text-white">
            <span className="text-primary-fixed-dim">RAKKEN</span> {station}
          </h1>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
          {isWrongRole ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-zinc-300">
                Akun <span className="font-semibold text-white">{session?.user?.name}</span> tidak punya akses ke halaman ini.
              </p>
              <Button variant="surface" size="lg" className="w-full" onClick={() => signOut({ redirect: false })}>
                Login sebagai user lain
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                  {error}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="kds-username" className="text-zinc-300">Username</Label>
                <Input
                  id="kds-username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  className={darkInput}
                  placeholder="Masukkan username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kds-password" className="text-zinc-300">Password</Label>
                <Input
                  id="kds-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className={darkInput}
                />
              </div>
              <Button type="submit" variant="brand" size="lg" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="animate-spin" aria-hidden />}
                {isLoading ? 'Masuk...' : 'Masuk'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
