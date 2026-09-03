import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authConfig } from './auth.config';

const LoginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

/**
 * Validates username/password against the same User table NextAuth's
 * Credentials provider uses below — called directly (not through NextAuth)
 * by /api/member/admin/login, since the Member App's admin area lives on a
 * different domain and can't rely on this app's session cookie. See
 * docs/reference/LOYALTY-MEMBER-APP.md §2.
 */
export async function verifyCredentials(username: string, password: string) {
  const parsed = LoginSchema.safeParse({ username, password });
  if (!parsed.success) return null;

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!user || !user.passwordHash) return null;

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, name: user.name, role: user.role };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { username: parsed.data.username },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          role: user.role,
          stationId: user.defaultStationId,
        } as any;
      }
    })
  ],
});
