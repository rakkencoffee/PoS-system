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

      // Handle login redirection
      if (pathname === '/login') {
        if (isLoggedIn) {
          return Response.redirect(new URL('/pos', nextUrl));
        }
        return true;
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
          pathname.startsWith('/menu') || 
          pathname.startsWith('/cart') || 
          pathname.startsWith('/checkout') || 
          pathname.startsWith('/success') || 
          pathname.startsWith('/status') || 
          pathname.startsWith('/favicon.ico');

        if (isPublic) return true;
        return false; // Redirects to login
      }

      // Role check for dashboard
      if (pathname.startsWith('/dashboard') && (auth?.user as any)?.role === 'cashier') {
        return Response.redirect(new URL('/pos', nextUrl));
      }

      return true;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
} satisfies NextAuthConfig;
