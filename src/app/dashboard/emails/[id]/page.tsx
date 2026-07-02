import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { DraftEditor } from './draft-editor'

export default async function EmailDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireSession()

  const draft = await db.emailDraft.findFirst({
    where: { id, organisationId: user.organisationId },
    include: { store: { include: { retailChain: true } }, skus: { include: { sku: true } } },
  })
  if (!draft) notFound()

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">
        {draft.status === 'SENT' ? 'Sent email' : 'Email draft'}
      </h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">
        To {draft.store.name} ({draft.store.retailChain.name}) · covers{' '}
        {draft.skus.map((s) => s.sku.name).join(', ')}
        {draft.sentAt && ` · sent ${draft.sentAt.toLocaleString()}`}
      </p>

      <DraftEditor
        draft={{
          id: draft.id,
          subject: draft.subject,
          body: draft.body,
          recipientEmail: draft.recipientEmail ?? '',
          recipientName: draft.recipientName ?? '',
          status: draft.status,
        }}
      />
    </main>
  )
}
