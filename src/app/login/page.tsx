'use client'

import { Suspense, useActionState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { login, type LoginState } from '@/lib/actions/login'

function LoginForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-sm text-zinc-600">
        No account?{' '}
        <Link href="/register" className="text-emerald-700 underline">
          Register your organisation
        </Link>
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="mb-6 text-2xl font-bold">Sign in to Lerke</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}
