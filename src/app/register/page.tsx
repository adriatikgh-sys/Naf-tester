'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { registerOrganisation, type RegisterState } from '@/lib/actions/register'

const inputClass =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600'

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerOrganisation,
    {},
  )

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="mb-2 text-2xl font-bold">Create your Lerke account</h1>
      <p className="mb-6 max-w-sm text-center text-sm text-zinc-600">
        Registration creates your organisation and makes you its first admin.
      </p>
      <form action={formAction} className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="organisationName" className="block text-sm font-medium mb-1">
            Organisation name
          </label>
          <input id="organisationName" name="organisationName" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="userName" className="block text-sm font-medium mb-1">
            Your name
          </label>
          <input id="userName" name="userName" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input id="email" name="email" type="email" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password (min. 10 characters)
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="currencyCode" className="block text-sm font-medium mb-1">
              Currency
            </label>
            <select id="currencyCode" name="currencyCode" defaultValue="NOK" className={inputClass}>
              <option value="NOK">NOK</option>
              <option value="SEK">SEK</option>
              <option value="DKK">DKK</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div>
            <label htmlFor="locale" className="block text-sm font-medium mb-1">
              Language
            </label>
            <select id="locale" name="locale" defaultValue="nb-NO" className={inputClass}>
              <option value="nb-NO">Norsk (bokmål)</option>
              <option value="sv-SE">Svenska</option>
              <option value="da-DK">Dansk</option>
              <option value="fi-FI">Suomi</option>
              <option value="en-GB">English</option>
            </select>
          </div>
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create organisation'}
        </button>
        <p className="text-sm text-zinc-600">
          Already registered?{' '}
          <Link href="/login" className="text-emerald-700 underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  )
}
