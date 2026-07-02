import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getAlerts } from '@/lib/queries/stock'

export default async function AlertsPage() {
  const user = await requireSession()
  const [org, alerts] = await Promise.all([
    db.organisation.findUniqueOrThrow({ where: { id: user.organisationId } }),
    getAlerts(user.organisationId),
  ])

  const money = new Intl.NumberFormat(org.locale, {
    style: 'currency',
    currency: org.currencyCode,
    maximumFractionDigits: 0,
  })

  // Group by store so one reorder email can cover all its low/out SKUs.
  const byStore = new Map<string, { storeName: string; chainName: string; rows: typeof alerts }>()
  for (const a of alerts) {
    const entry = byStore.get(a.storeId) ?? { storeName: a.storeName, chainName: a.chainName, rows: [] }
    entry.rows.push(a)
    byStore.set(a.storeId, entry)
  }
  const storeGroups = [...byStore.entries()]
    .map(([storeId, g]) => ({
      storeId,
      ...g,
      totalLost: g.rows.reduce((sum, r) => sum + (r.estimatedLostSales ?? 0), 0),
    }))
    .sort((a, b) => b.totalLost - a.totalLost)

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">Alerts</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">
        Stores with low or out-of-stock SKUs, ranked by estimated lost sales
        (days out of stock over the last 28 days × weekly velocity × price ×
        margin). Estimates need price, margin and velocity set on the SKU.
      </p>

      {storeGroups.length === 0 && (
        <div className="rounded-lg border border-zinc-200 p-8 text-center text-sm text-zinc-600">
          Nothing is low or out of stock right now.
        </div>
      )}

      <div className="space-y-6">
        {storeGroups.map((group) => (
          <section key={group.storeId} className="rounded-lg border border-zinc-200">
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div>
                <h2 className="font-semibold">{group.storeName}</h2>
                <p className="text-xs text-zinc-500">{group.chainName}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-zinc-500">est. lost sales (28d)</p>
                  <p className="font-semibold tabular-nums">
                    {group.totalLost > 0 ? money.format(group.totalLost) : '—'}
                  </p>
                </div>
                <Link
                  href={`/dashboard/emails/new?storeId=${group.storeId}`}
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Draft reorder email
                </Link>
              </div>
            </header>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Days out (28d)</th>
                  <th className="px-4 py-2 text-right">Est. lost sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {group.rows.map((row) => (
                  <tr key={row.skuId}>
                    <td className="px-4 py-2">
                      <Link href={`/dashboard/skus/${row.skuId}`} className="hover:underline">
                        {row.skuName}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {row.stockStatus === 'OUT_OF_STOCK' ? (
                        <span className="rounded bg-[#d03b3b] px-1.5 py-0.5 text-xs font-medium text-white">
                          ✕ out
                        </span>
                      ) : (
                        <span className="rounded bg-[#fab219] px-1.5 py-0.5 text-xs font-medium text-zinc-900">
                          ▲ low
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{row.quantity ?? '—'}</td>
                    <td className="px-4 py-2 tabular-nums">{row.daysOutLast28}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.estimatedLostSales != null ? money.format(row.estimatedLostSales) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </main>
  )
}
