import type { NextAuthConfig } from 'next-auth'
import type { UserRole } from '@/generated/prisma/enums'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      organisationId: string
      role: UserRole
    }
  }
}

/**
 * Config shared between the full server-side auth (src/lib/auth.ts) and the
 * middleware. Must stay free of Node-only imports (Prisma, bcrypt) so the
 * middleware bundle can run on the edge runtime — providers are added only
 * in auth.ts.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // On sign-in, copy tenant identity into the token; afterwards the token
      // is the source of truth (no DB hit per request).
      if (user) {
        token.sub = user.id
        token.organisationId = (user as { organisationId: string }).organisationId
        token.role = (user as { role: UserRole }).role
        token.name = user.name
        token.email = user.email
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub as string
      session.user.organisationId = token.organisationId as string
      session.user.role = token.role as UserRole
      return session
    },
  },
} satisfies NextAuthConfig
