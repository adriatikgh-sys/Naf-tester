import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getStockMatrix } from '@/lib/queries/stock'
import type { StockStatus } from '@/generated/prisma/enums'

/** Effective status: recompute against the SKU's (or org's) threshold when a
 *  quantity is known, so threshold edits take effect without a new scrape. */
function effectiveStatus(
  quantity: number | null,
  reported: StockStatus,
  threshold: number,
): StockStatus {
  if (quantity == null) return reported
  if (quantity <= 0) return 'OUT_OF_STOCK'
  if (quantity <= threshold) return 'LOW_STOCK'
  return 'IN_STOCK'
}

// Status palette (reserved): good/warning/critical + neutral for unknown.
const cellStyle: Record<StockStatus, string> = {
  IN_STOCK: 'bg-[#0ca30c]/10 text-zinc-900',
  LOW_STOCK: 'bg-[#fab219] text-zinc-900',
  OUT_OF_STOCK: 'bg-[#d03b3b] text-white',
  UNKNOWN: 'bg-zinc-100 text-zinc-500',
}

export default async function StockMatrixPage() {
  const user = await requireSession()
  const [org, cells] = await Promise.all([
    db.organisation.findUniqueOrThrow({ where: { id: user.organisationId } }),
    getStockMatrix(user.organisationId),
  ])

  // Pivot: rows = SKUs, columns = stores (grouped under their chain).
  const stores = new Map<string, { id: string; name: string; chainName: string }>()
  const skus = new Map<string, { id: string; name: string; threshold: number }>()
  const byKey = new Map<string, (typeof cells)[number]>()
  for (const c of cells) {
    stores.set(c.storeId, { id: c.storeId, name: c.storeName, chainName: c.chainName })
    skus.set(c.skuId, {
      id: c.skuId,
      name: c.skuName,
      threshold: c.lowStockThreshold ?? org.defaultLowStockThreshold,
    })
    byKey.set(`${c.skuId}:${c.storeId}`, c)
  }
  const storeCols = [...stores.values()].sort(
    (a, b) => a.chainName.localeCompare(b.chainName) || a.name.localeCompare(b.name),
  )
  const skuRows = [...skus.values()].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock matrix</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Latest known stock per SKU per store, coloured against each SKU&apos;s
            low-stock threshold (default {org.defaultLowStockThreshold}).
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-[#0ca30c]/20" /> in stock
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-[#fab219]" /> low
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-[#d03b3b]" /> out
          </span>
        </div>
      </div>

      {skuRows.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 p-8 text-center text-sm text-zinc-600">
          No stock data yet. Add SKUs in{' '}
          <Link href="/dashboard/skus" className="text-emerald-700 underline">
            Catalog
          </Link>
          , activate your chains in{' '}
          <Link href="/dashboard/settings/chains" className="text-emerald-700 underline">
            Chains
          </Link>
          , and map each SKU to the chain&apos;s product ID.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs uppercase text-zinc-600">
                <th className="sticky left-0 bg-zinc-50 px-3 py-2">SKU</th>
                {storeCols.map((s) => (
                  <th key={s.id} className="px-2 py-2 font-medium">
                    <div className="text-[10px] font-normal text-zinc-400">{s.chainName}</div>
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {skuRows.map((sku) => (
                <tr key={sku.id}>
                  <td className="sticky left-0 bg-white px-3 py-1.5 font-medium">
                    <Link href={`/dashboard/skus/${sku.id}`} className="hover:underline">
                      {sku.name}
                    </Link>
                  </td>
                  {storeCols.map((store) => {
                    const cell = byKey.get(`${sku.id}:${store.id}`)
                    if (!cell)
                      return (
                        <td key={store.id} className="px-2 py-1.5 text-center text-zinc-300">
                          ·
                        </td>
                      )
                    const status = effectiveStatus(cell.quantity, cell.stockStatus, sku.threshold)
                    return (
                      <td key={store.id} className="p-1">
                        <div
                          title={`${sku.name} @ ${store.name}: ${cell.quantity ?? status} (${new Date(cell.recordedAt).toLocaleDateString()})`}
                          className={`rounded px-2 py-1 text-center tabular-nums ${cellStyle[status]}`}
                        >
                          {cell.quantity ?? (status === 'UNKNOWN' ? '?' : status === 'OUT_OF_STOCK' ? '0' : '•')}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
