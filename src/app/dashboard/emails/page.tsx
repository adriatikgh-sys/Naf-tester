import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'

export default async function EmailsPage() {
  const user = await requireSession()
  const drafts = await db.emailDraft.findMany({
    where: { organisationId: user.organisationId },
    include: { store: true, skus: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">Reorder emails</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">
        Drafts are generated from the Alerts page. Edit, then mark as sent once
        you&apos;ve mailed the store.
      </p>

      {drafts.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 p-8 text-center text-sm text-zinc-600">
          No drafts yet — go to{' '}
          <Link href="/dashboard/alerts" className="text-emerald-700 underline">
            Alerts
          </Link>{' '}
          and draft a reorder email for a store with low stock.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Link
                href={`/dashboard/emails/${draft.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-50"
              >
                <div>
                  <p className="font-medium">{draft.subject}</p>
                  <p className="text-xs text-zinc-500">
                    {draft.store.name} · {draft.skus.length} SKUs ·{' '}
                    {draft.createdAt.toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    draft.status === 'SENT'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {draft.status === 'SENT' ? 'sent' : 'draft'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
