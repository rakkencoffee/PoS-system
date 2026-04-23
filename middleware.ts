import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

/**
 * Middleware using NextAuth v5 Edge Configuration.
 * 
 * To keep the bundle size under 1MB, we only import from auth.config.ts,
 * avoiding heavy libraries like Prisma and bcrypt.
 */

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|monitoring|images|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)).*)',
  ],
};
