import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authConfig } from '@/lib/auth.config'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        })
        if (!user) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organisationId: user.organisationId,
          role: user.role,
        }
      },
    }),
  ],
})

/**
 * The tenant context every server action / route handler must go through.
 * Throws if unauthenticated — callers never see a half-empty context.
 */
export async function requireSession() {
  const session = await auth()
  if (!session?.user?.organisationId) {
    throw new Error('UNAUTHENTICATED')
  }
  return session.user
}

export async function requireAdmin() {
  const user = await requireSession()
  if (user.role !== 'ADMIN') {
    throw new Error('FORBIDDEN')
  }
  return user
}
