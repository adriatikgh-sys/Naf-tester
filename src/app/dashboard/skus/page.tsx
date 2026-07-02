import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { SkuForms, SkuTable } from './sku-ui'

export default async function SkusPage() {
  const user = await requireSession()

  const [skus, activeChains] = await Promise.all([
    db.sku.findMany({
      where: { organisationId: user.organisationId },
      include: { chainMappings: true },
      orderBy: { name: 'asc' },
    }),
    db.retailChain.findMany({
      where: {
        orgLinks: { some: { organisationId: user.organisationId, isActive: true } },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold">Product catalog</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">
        {skus.length} SKUs. Map each SKU to the product ID the chain itself uses
        (for Jernia this is their internal product code, not the EAN).
      </p>

      <SkuForms />

      <SkuTable
        chains={activeChains}
        skus={skus.map((s) => ({
          id: s.id,
          name: s.name,
          ean: s.ean,
          internalCode: s.internalCode,
          unitPrice: s.unitPrice?.toString() ?? null,
          currencyCode: s.currencyCode,
          marginRate: s.marginRate?.toString() ?? null,
          avgWeeklyVelocity: s.avgWeeklyVelocity?.toString() ?? null,
          lowStockThreshold: s.lowStockThreshold,
          mappings: Object.fromEntries(
            s.chainMappings.map((m) => [m.retailChainId, m.externalProductId]),
          ),
        }))}
      />
    </main>
  )
}
