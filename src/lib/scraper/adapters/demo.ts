import type { ChainAdapter, ScrapeOutcome, ScrapeStore, ScrapeTarget } from '../types'
import { StockStatus } from '@/generated/prisma/enums'

/**
 * Adapter for the fictional seed chains ("Nordvare (demo)", "Hus & Hage
 * (demo)"). Produces plausible pseudo-random stock levels so the entire
 * pipeline — trigger, run bookkeeping, readings, dashboard — can be exercised
 * without touching any real retailer.
 */
function makeDemoAdapter(slug: string): ChainAdapter {
  return {
    slug,
    async fetchStock(targets: ScrapeTarget[], stores: ScrapeStore[]): Promise<ScrapeOutcome> {
      const items = []
      for (const target of targets) {
        for (const store of stores) {
          // Hash-ish determinism per (product, store, hour) so repeated manual
          // runs within the hour agree with each other.
          const seedStr = `${target.externalProductId}:${store.externalId}:${new Date().toISOString().slice(0, 13)}`
          let h = 0
          for (const c of seedStr) h = (h * 31 + c.charCodeAt(0)) | 0
          const quantity = Math.abs(h) % 25
          items.push({
            skuId: target.skuId,
            storeId: store.storeId,
            quantity,
            stockStatus:
              quantity === 0
                ? StockStatus.OUT_OF_STOCK
                : quantity <= 5
                  ? StockStatus.LOW_STOCK
                  : StockStatus.IN_STOCK,
          })
        }
      }
      return { items, errors: [] }
    },
  }
}

export const demoAdapters = [makeDemoAdapter('nordvare-demo'), makeDemoAdapter('hus-og-hage-demo')]
