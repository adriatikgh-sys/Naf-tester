import { requireSession, signOut } from '@/lib/auth'
import { db } from '@/lib/db'

export default async function DashboardPage() {
  const user = await requireSession()

  const [org, skuCount, chainLinkCount] = await Promise.all([
    db.organisation.findUniqueOrThrow({ where: { id: user.organisationId } }),
    db.sku.count({ where: { organisationId: user.organisationId } }),
    db.organisationChainLink.count({
      where: { organisationId: user.organisationId, isActive: true },
    }),
  ])

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-zinc-600">
            Signed in as {user.name} ({user.role.toLowerCase()})
          </p>
        </div>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">
            Sign out
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm text-zinc-600">SKUs in catalog</p>
          <p className="text-3xl font-bold">{skuCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm text-zinc-600">Active chains</p>
          <p className="text-3xl font-bold">{chainLinkCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm text-zinc-600">Currency</p>
          <p className="text-3xl font-bold">{org.currencyCode}</p>
        </div>
      </div>

      <p className="mt-8 text-sm text-zinc-500">
        Stock matrix, alerts, and SKU management land here in the next build steps.
      </p>
    </main>
  )
}
