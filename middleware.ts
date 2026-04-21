import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Login page access
  if (pathname === '/login') {
    if (session) {
      return NextResponse.redirect(new URL('/pos', req.url));
    }
    return NextResponse.next();
  }

  // Auth guard: protect everything except public assets, login, and auth APIs
  if (!session) {
    // Check if the path is not public/auth related
    const isPublic = 
      pathname === '/' || 
      pathname.startsWith('/_next') || 
      pathname.startsWith('/api/auth') || 
      pathname.startsWith('/favicon.ico');

    if (!isPublic) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Role guard: dashboard logic from PLAN.md
  if (pathname.startsWith('/dashboard') && (session?.user as any)?.role === 'cashier') {
    return NextResponse.redirect(new URL('/pos', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
