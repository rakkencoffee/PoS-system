import type { NextAuthConfig } from 'next-auth';

// This configuration is shared between the full auth.ts (server-side)
// and the middleware (edge-compatible).
// We keep it lean to stay under the 1MB Edge Function limit.

export const authConfig = {
  providers: [], // We'll add Credentials provider only in the non-edge auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.stationId = (user as any).stationId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).stationId = token.stationId;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // /barista and /kitchen handle their own auth client-side (KdsAuthGate shows
      // an inline login form when unauthenticated) — there's no standalone /login
      // page to redirect to, so let the middleware pass these through untouched.
      if (pathname.startsWith('/barista') || pathname.startsWith('/kitchen')) {
        return true;
      }

      if (pathname.startsWith('/admin/login')) {
        return true;
      }

      // Admin pages have their own login screen -- send them there instead of
      // the default signIn page (/kitchen, the KDS login).
      if (pathname.startsWith('/admin') && !isLoggedIn) {
        const loginUrl = new URL('/admin/login', nextUrl);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return Response.redirect(loginUrl);
      }

      // Protect all other routes
      if (!isLoggedIn) {
        // Allow public assets and auth APIs
        const isPublic =
          pathname === '/' ||
          pathname.startsWith('/_next') ||
          pathname.startsWith('/api/auth') ||
          pathname.startsWith('/api/webhooks') ||
          pathname.startsWith('/api/jobs') ||
          pathname.startsWith('/api/categories') ||
          pathname.startsWith('/api/menu') ||
          pathname.startsWith('/api/payment') ||
          pathname.startsWith('/menu') ||
          pathname.startsWith('/cart') ||
          pathname.startsWith('/checkout') ||
          pathname.startsWith('/success') ||
          pathname.startsWith('/status') ||
          pathname.startsWith('/favicon.ico');

        if (isPublic) return true;
        return false; // Redirects to signIn page
      }

      return true;
    },
  },
  pages: {
    signIn: '/kitchen',
    error: '/kitchen',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
} satisfies NextAuthConfig;
