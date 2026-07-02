import type { StockStatus } from '@/generated/prisma/enums'

/** One SKU the adapter must check, with the chain's own product id. */
export type ScrapeTarget = {
  skuId: string
  externalProductId: string
}

/** A store of the chain, as the adapter needs to identify it upstream. */
export type ScrapeStore = {
  storeId: string
  externalId: string
  name: string
}

export type ScrapeResultItem = {
  skuId: string
  storeId: string
  quantity: number | null
  stockStatus: StockStatus
}

export type ScrapeItemError = {
  skuId: string
  storeId?: string
  message: string
}

export type ScrapeOutcome = {
  items: ScrapeResultItem[]
  errors: ScrapeItemError[]
}

/**
 * One adapter per retail chain, selected by RetailChain.slug.
 * Adapters receive only the targets that passed the OrganisationChainLink
 * opt-in filter — they never decide scope themselves.
 */
export interface ChainAdapter {
  slug: string
  fetchStock(
    targets: ScrapeTarget[],
    stores: ScrapeStore[],
    connectionConfig: unknown,
  ): Promise<ScrapeOutcome>
}
