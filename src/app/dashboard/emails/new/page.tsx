import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getAlerts } from '@/lib/queries/stock'
import { GenerateButton } from './generate-button'

export default async function NewEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string }>
}) {
  const { storeId } = await searchParams
  const user = await requireSession()

  const store = storeId
    ? await db.store.findFirst({
        where: {
          id: storeId,
          retailChain: {
            orgLinks: { some: { organisationId: user.organisationId, isActive: true } },
          },
        },
        include: { retailChain: true },
      })
    : null

  if (!store) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-zinc-600">Store not found — pick one from the Alerts page.</p>
      </main>
    )
  }

  const items = (await getAlerts(user.organisationId)).filter((a) => a.storeId === store.id)
  const aiConfigured = !!process.env.ANTHROPIC_API_KEY

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Draft reorder email</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">
        For {store.name} ({store.retailChain.name}) — covering {items.length} low/out SKUs.
      </p>

      <ul className="mb-6 rounded-lg border border-zinc-200 p-4 text-sm">
        {items.map((i) => (
          <li key={i.skuId} className="flex justify-between py-1">
            <span>{i.skuName}</span>
            <span className="text-zinc-500">
              {i.stockStatus === 'OUT_OF_STOCK' ? 'out of stock' : `low (${i.quantity})`}
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="text-zinc-500">Nothing low or out right now.</li>}
      </ul>

      {!aiConfigured && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
          ANTHROPIC_API_KEY isn&apos;t configured — the draft will use a plain
          template instead of AI generation. Add the key to .env to enable Claude.
        </p>
      )}

      {items.length > 0 && <GenerateButton storeId={store.id} />}
    </main>
  )
}
