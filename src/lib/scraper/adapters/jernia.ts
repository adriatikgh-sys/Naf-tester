import { z } from 'zod'
import type { ChainAdapter, ScrapeItemError, ScrapeOutcome, ScrapeResultItem, ScrapeStore, ScrapeTarget } from '../types'
import { StockStatus } from '@/generated/prisma/enums'

/**
 * Jernia adapter — SAP Commerce (Hybris) OCC v2 API.
 *
 * ── STATUS: UNVERIFIED ────────────────────────────────────────────────────
 * Written against the standard OCC v2 shape (JSON REST under
 * ecommerce.jernia.no/rest/v2/<baseSiteId>/...) plus the one known fact that
 * Jernia keys products by an INTERNAL product code, not EAN
 * (SkuChainMapping.externalProductId must hold that internal code).
 *
 * ASSUMPTIONS TO VERIFY against the live site before enabling the chain
 * (RetailChain.isEnabled stays false until then):
 *  A1. baseSiteId — assumed "jernia". Check any XHR the storefront makes.
 *  A2. Store stock endpoint — standard OCC exposes
 *      GET /rest/v2/{site}/products/{code}/stock?location=...&pageSize=...
 *      returning { stores: [{ name, displayName, stockInfo: { stockLevel,
 *      stockLevelStatus } }] }. Jernia may have customised this.
 *  A3. Store identifier — OCC "name" (a unique key, often a store number)
 *      is what Store.externalId must contain.
 *  A4. Whether the endpoint is anonymous or needs an OAuth client token
 *      (OCC default allows anonymous product/stock reads).
 *  A5. stockLevelStatus values — OCC defaults: "inStock" | "lowStock" |
 *      "outOfStock".
 * Each assumption fails loudly (item error, run marked PARTIAL/FAILED) —
 * nothing is silently guessed into the database.
 * ──────────────────────────────────────────────────────────────────────────
 */

const configSchema = z.object({
  baseUrl: z.string().url().default('https://ecommerce.jernia.no'),
  baseSiteId: z.string().default('jernia'), // A1
  /** ms pause between product requests, be polite by default */
  requestDelayMs: z.number().int().min(0).default(750),
  /** OCC stock search needs a location query or lat/long; configurable. */
  locationQuery: z.string().default('Norge'), // A2
})

// A2/A5: expected OCC response shape.
const stockResponseSchema = z.object({
  stores: z
    .array(
      z.object({
        name: z.string().optional(),
        displayName: z.string().optional(),
        stockInfo: z
          .object({
            stockLevel: z.number().optional(),
            stockLevelStatus: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  pagination: z.object({ totalPages: z.number().optional() }).optional(),
})

function toStatus(stockLevelStatus: string | undefined, stockLevel: number | undefined): StockStatus {
  if (stockLevel != null) {
    if (stockLevel <= 0) return StockStatus.OUT_OF_STOCK
    if (stockLevel <= 5) return StockStatus.LOW_STOCK
    return StockStatus.IN_STOCK
  }
  switch (stockLevelStatus) {
    case 'inStock':
      return StockStatus.IN_STOCK
    case 'lowStock':
      return StockStatus.LOW_STOCK
    case 'outOfStock':
      return StockStatus.OUT_OF_STOCK
    default:
      return StockStatus.UNKNOWN
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const jerniaAdapter: ChainAdapter = {
  slug: 'jernia',
  async fetchStock(
    targets: ScrapeTarget[],
    stores: ScrapeStore[],
    connectionConfig: unknown,
  ): Promise<ScrapeOutcome> {
    const config = configSchema.parse(connectionConfig ?? {})
    const storeByExternalId = new Map(stores.map((s) => [s.externalId, s]))
    const items: ScrapeResultItem[] = []
    const errors: ScrapeItemError[] = []

    for (const [i, target] of targets.entries()) {
      if (i > 0) await sleep(config.requestDelayMs)

      const url =
        `${config.baseUrl}/rest/v2/${config.baseSiteId}/products/` +
        `${encodeURIComponent(target.externalProductId)}/stock` +
        `?location=${encodeURIComponent(config.locationQuery)}&pageSize=100&fields=FULL`

      try {
        const res = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'LerkeStockMonitor/1.0 (inventory monitoring on behalf of distributors)',
          },
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) {
          errors.push({
            skuId: target.skuId,
            message: `HTTP ${res.status} from ${url} (verify assumptions A1/A2/A4 in jernia.ts)`,
          })
          continue
        }
        const parsed = stockResponseSchema.safeParse(await res.json())
        if (!parsed.success || !parsed.data.stores) {
          errors.push({
            skuId: target.skuId,
            message: 'Response shape did not match OCC stock schema (assumption A2/A5)',
          })
          continue
        }
        for (const occStore of parsed.data.stores) {
          const key = occStore.name ?? occStore.displayName
          const store = key ? storeByExternalId.get(key) : undefined
          if (!store) continue // store not in our DB (or A3 wrong — surfaced by zero matches)
          items.push({
            skuId: target.skuId,
            storeId: store.storeId,
            quantity: occStore.stockInfo?.stockLevel ?? null,
            stockStatus: toStatus(occStore.stockInfo?.stockLevelStatus, occStore.stockInfo?.stockLevel),
          })
        }
        if (parsed.data.stores.length > 0 && items.every((it) => it.skuId !== target.skuId)) {
          errors.push({
            skuId: target.skuId,
            message: 'Stock returned but no store matched Store.externalId (assumption A3)',
          })
        }
      } catch (e) {
        errors.push({
          skuId: target.skuId,
          message: e instanceof Error ? e.message : 'fetch failed',
        })
      }
    }
    return { items, errors }
  },
}
