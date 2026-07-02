'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteEmailDraft,
  markEmailSent,
  updateEmailDraft,
  type EmailActionState,
} from '@/lib/actions/emails'

const inputClass =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600'

type Draft = {
  id: string
  subject: string
  body: string
  recipientEmail: string
  recipientName: string
  status: 'DRAFT' | 'SENT'
}

export function DraftEditor({ draft }: { draft: Draft }) {
  const router = useRouter()
  const [state, saveAction, saving] = useActionState<EmailActionState, FormData>(
    updateEmailDraft.bind(null, draft.id),
    {},
  )
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const readOnly = draft.status === 'SENT'

  return (
    <form action={saveAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Recipient name</label>
          <input name="recipientName" defaultValue={draft.recipientName} disabled={readOnly} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Recipient email</label>
          <input name="recipientEmail" type="email" defaultValue={draft.recipientEmail} disabled={readOnly} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Subject</label>
        <input name="subject" defaultValue={draft.subject} disabled={readOnly} required className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Body</label>
        <textarea name="body" defaultValue={draft.body} disabled={readOnly} required rows={14} className={inputClass} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-700">Saved.</p>}
      {message && <p className="text-sm text-zinc-600">{message}</p>}

      <div className="flex gap-3">
        {!readOnly && (
          <>
            <button
              type="submit"
              disabled={saving || pending}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              disabled={saving || pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await markEmailSent(draft.id)
                  setMessage(res.error ?? null)
                  if (!res.error) router.refresh()
                })
              }
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Mark as sent
            </button>
          </>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (confirm('Delete this email?')) {
                await deleteEmailDraft(draft.id)
                router.push('/dashboard/emails')
              }
            })
          }
          className="ml-auto text-sm text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    </form>
  )
}
