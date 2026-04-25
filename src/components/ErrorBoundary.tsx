'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from "@sentry/nextjs";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    Sentry.captureException(error, { 
      extra: { componentStack: errorInfo.componentStack } 
    });
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center p-8 bg-black">
          <div className="max-w-md w-full text-center space-y-6 animate-fade-in">
            <div className="w-24 h-24 bg-[#A8131E]/20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-[#A8131E]/30">
              <span className="text-5xl">☕</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Oops, Kopi Tumpah!</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Terjadi sedikit gangguan dI sistem. Jangan khawatir, pesanan Anda dI keranjang tetap aman.
            </p>
            <div className="pt-4 space-y-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.reload();
                }}
                className="w-full py-4 rounded-2xl bg-[#A8131E] text-white font-bold shadow-lg shadow-[#A8131E]/20 active:scale-95 transition-all"
              >
                Muat Ulang Halaman
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full py-4 rounded-2xl bg-white/5 text-zinc-300 font-medium border border-white/10 hover:bg-white/10"
              >
                Kembali ke Beranda
              </button>
            </div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest pt-8">
              Error reported to Sentry
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
