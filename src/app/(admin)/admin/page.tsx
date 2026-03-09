'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple password check for demo
    if (password === 'admin123') {
      localStorage.setItem('admin_auth', 'true');
      router.push('/admin/dashboard');
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl mb-4 block">🔐</span>
          <h1 className="text-3xl font-bold text-gradient mb-2">Admin Panel</h1>
          <p className="text-(--text-muted)">StartFriday Coffee</p>
        </div>

        <form onSubmit={handleLogin} className="glass-card p-6 space-y-4">
          <div>
            <label className="block text-sm text-(--text-secondary) mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter admin password"
              className="w-full px-4 py-3 rounded-xl bg-(--bg-card) border border-(--border-subtle) text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:border-[#A8131E]"
            />
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>
          <button type="submit" className="btn-primary w-full">
            Login
          </button>
          <p className="text-xs text-(--text-muted) text-center">Demo password: admin123</p>
        </form>
      </div>
    </div>
  );
}
