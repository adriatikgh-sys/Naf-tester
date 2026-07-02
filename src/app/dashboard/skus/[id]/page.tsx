import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSkuTrend } from '@/lib/queries/stock'
import { TrendChart, type TrendSeries } from './trend-chart'

// Fixed categorical order (validated palette) — assigned by store sort order,
// stable across visits, never cycled.
const SERIES_COLORS = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']

export default async function SkuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireSession()

  const sku = await db.sku.findFirst({
    where: { id, organisationId: user.organisationId },
    include: { chainMappings: { include: { retailChain: true } } },
  })
  if (!sku) notFound()

  const trend = await getSkuTrend(user.organisationId, sku.id, 28)

  // Bucket to one value per store per day (last reading wins).
  const dayKeys = new Set<string>()
  const perStore = new Map<string, { name: string; values: Map<string, number | null> }>()
  for (const point of trend) {
    const day = point.day.toISOString().slice(0, 10)
    dayKeys.add(day)
    const entry = perStore.get(point.storeId) ?? { name: point.storeName, values: new Map() }
    entry.values.set(day, point.quantity)
    perStore.set(point.storeId, entry)
  }
  const days = [...dayKeys].sort()
  const series: TrendSeries[] = [...perStore.entries()]
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .slice(0, SERIES_COLORS.length)
    .map(([storeId, s], i) => ({
      id: storeId,
      name: s.name,
      color: SERIES_COLORS[i],
      values: days.map((d) => s.values.get(d) ?? null),
    }))

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">{sku.name}</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600">
        {sku.ean ? `EAN ${sku.ean}` : 'No EAN'}
        {sku.internalCode ? ` · ${sku.internalCode}` : ''}
        {sku.unitPrice ? ` · ${sku.unitPrice.toString()} ${sku.currencyCode ?? ''}` : ''}
      </p>

      <section className="rounded-lg border border-zinc-200 p-4">
        <h2 className="mb-1 font-semibold">Stock on shelf — last 28 days</h2>
        {series.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No readings yet for this SKU.
          </p>
        ) : (
          <TrendChart days={days} series={series} />
        )}
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4">
        <h2 className="mb-2 font-semibold">Chain mappings</h2>
        {sku.chainMappings.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Not mapped to any chain yet — set the chain&apos;s product ID in the catalog table.
          </p>
        ) : (
          <ul className="text-sm">
            {sku.chainMappings.map((m) => (
              <li key={m.id} className="flex justify-between border-b border-zinc-100 py-1.5 last:border-0">
                <span>{m.retailChain.name}</span>
                <span className="tabular-nums text-zinc-600">{m.externalProductId}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
