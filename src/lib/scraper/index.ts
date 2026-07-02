import { db } from '@/lib/db'
import type { ChainAdapter } from './types'
import { demoAdapters } from './adapters/demo'
import { jerniaAdapter } from './adapters/jernia'

const adapters = new Map<string, ChainAdapter>(
  [...demoAdapters, jerniaAdapter].map((a) => [a.slug, a]),
)

/**
 * Execute one ScrapeRun. Scope rules (the opt-in requirement):
 *  - The SKU work list comes from SkuChainMapping rows whose organisation has
 *    an ACTIVE OrganisationChainLink for this chain — never "all mappings".
 *  - Manual runs (run.organisationId set) narrow further to that single
 *    organisation.
 */
export async function executeScrapeRun(runId: string): Promise<void> {
  const run = await db.scrapeRun.findUniqueOrThrow({
    where: { id: runId },
    include: { retailChain: true },
  })

  await db.scrapeRun.update({
    where: { id: runId },
    data: { status: 'RUNNING', startedAt: new Date() },
  })

  try {
    const adapter = adapters.get(run.retailChain.slug)
    if (!adapter) {
      throw new Error(`No adapter registered for chain slug "${run.retailChain.slug}"`)
    }

    const mappings = await db.skuChainMapping.findMany({
      where: {
        retailChainId: run.retailChainId,
        sku: {
          isActive: true,
          ...(run.organisationId ? { organisationId: run.organisationId } : {}),
          organisation: {
            chainLinks: {
              some: { retailChainId: run.retailChainId, isActive: true },
            },
          },
        },
      },
      select: { skuId: true, externalProductId: true },
    })

    const stores = await db.store.findMany({
      where: { retailChainId: run.retailChainId, isActive: true },
      select: { id: true, externalId: true, name: true },
    })

    if (mappings.length === 0) {
      await db.scrapeRun.update({
        where: { id: runId },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          errorSummary: [{ message: 'No mapped SKUs in scope for this chain — nothing to do.' }],
        },
      })
      return
    }

    const outcome = await adapter.fetchStock(
      mappings.map((m) => ({ skuId: m.skuId, externalProductId: m.externalProductId })),
      stores.map((s) => ({ storeId: s.id, externalId: s.externalId, name: s.name })),
      run.retailChain.connectionConfig,
    )

    if (outcome.items.length > 0) {
      await db.stockReading.createMany({
        data: outcome.items.map((item) => ({
          skuId: item.skuId,
          storeId: item.storeId,
          quantity: item.quantity,
          stockStatus: item.stockStatus,
          scrapeRunId: runId,
        })),
      })
    }

    await db.scrapeRun.update({
      where: { id: runId },
      data: {
        status:
          outcome.errors.length === 0
            ? 'SUCCESS'
            : outcome.items.length > 0
              ? 'PARTIAL'
              : 'FAILED',
        finishedAt: new Date(),
        readingsCount: outcome.items.length,
        errorSummary: outcome.errors.length > 0 ? outcome.errors.slice(0, 50) : undefined,
      },
    })
  } catch (e) {
    await db.scrapeRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorSummary: [{ message: e instanceof Error ? e.message : 'unknown error' }],
      },
    })
  }
}

/**
 * The daily job. Chain list comes exclusively from OrganisationChainLink:
 * a chain nobody activated is never touched, however many rows RetailChain
 * has. Chains are processed sequentially to avoid bursts.
 */
export async function runDailyScrapes(): Promise<{ chainSlug: string; runId: string }[]> {
  const chains = await db.retailChain.findMany({
    where: {
      isEnabled: true,
      orgLinks: { some: { isActive: true } },
    },
    select: { id: true, slug: true },
  })

  const results: { chainSlug: string; runId: string }[] = []
  for (const chain of chains) {
    const run = await db.scrapeRun.create({
      data: { retailChainId: chain.id, trigger: 'CRON' },
    })
    await executeScrapeRun(run.id)
    results.push({ chainSlug: chain.slug, runId: run.id })
  }
  return results
}
