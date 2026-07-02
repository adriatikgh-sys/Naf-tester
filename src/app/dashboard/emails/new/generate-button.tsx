'use client'

import { useState, useTransition } from 'react'
import { createEmailDraft } from '@/lib/actions/emails'

export function GenerateButton({ storeId }: { storeId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <button
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const res = await createEmailDraft(storeId) // redirects on success
            if (res?.error) setError(res.error)
          })
        }
        disabled={pending}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? 'Generating draft…' : 'Generate draft'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
