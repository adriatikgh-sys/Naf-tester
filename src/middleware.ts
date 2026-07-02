import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

// Edge-safe auth instance (no providers/Prisma) — only decodes the JWT.
const { auth } = NextAuth(authConfig)

const PUBLIC_PATHS = new Set(['/', '/login', '/register'])

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth?.user

  if (!isLoggedIn && !PUBLIC_PATHS.has(pathname)) {
    const login = new URL('/login', req.nextUrl)
    login.searchParams.set('callbackUrl', pathname)
    return Response.redirect(login)
  }
  if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
    return Response.redirect(new URL('/dashboard', req.nextUrl))
  }
})

export const config = {
  // Everything except API routes (they enforce their own auth: NextAuth
  // handlers, CRON_SECRET on the cron route), static assets, and files.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
