import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `auth`, contains part of `User` from the database.
   */
  interface Session {
    user: {
      /** The user's role. */
      role: string
      stationId?: number | null
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    stationId?: number | null
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `auth`, when using JWT sessions */
  interface JWT {
    /** The user's role. */
    role: string
    stationId?: number | null
  }
}
