import { db } from '@/lib/db'
import { Prisma } from '@/generated/prisma/client'
import type { StockStatus } from '@/generated/prisma/enums'

/**
 * Tenant isolation contract: every query in this file takes organisationId
 * as its first argument and filters on it in SQL — and only surfaces stores
 * belonging to chains the organisation has actively opted into
 * (OrganisationChainLink.isActive).
 */

export type MatrixCell = {
  skuId: string
  skuName: string
  lowStockThreshold: number | null
  storeId: string
  storeName: string
  chainId: string
  chainName: string
  quantity: number | null
  stockStatus: StockStatus
  recordedAt: Date
}

/** Latest reading per (SKU, store) for the organisation's activated chains. */
export async function getStockMatrix(organisationId: string): Promise<MatrixCell[]> {
  return db.$queryRaw<MatrixCell[]>(Prisma.sql`
    SELECT DISTINCT ON (sr."skuId", sr."storeId")
      sr."skuId"          AS "skuId",
      s.name              AS "skuName",
      s."lowStockThreshold" AS "lowStockThreshold",
      sr."storeId"        AS "storeId",
      st.name             AS "storeName",
      rc.id               AS "chainId",
      rc.name             AS "chainName",
      sr.quantity         AS "quantity",
      sr."stockStatus"    AS "stockStatus",
      sr."recordedAt"     AS "recordedAt"
    FROM "StockReading" sr
    JOIN "Sku" s   ON s.id = sr."skuId"
    JOIN "Store" st ON st.id = sr."storeId"
    JOIN "RetailChain" rc ON rc.id = st."retailChainId"
    JOIN "OrganisationChainLink" ocl
      ON ocl."retailChainId" = st."retailChainId"
     AND ocl."organisationId" = s."organisationId"
     AND ocl."isActive" = true
    WHERE s."organisationId" = ${organisationId}
      AND s."isActive" = true
      AND st."isActive" = true
    ORDER BY sr."skuId", sr."storeId", sr."recordedAt" DESC
  `)
}

export type TrendPoint = {
  storeId: string
  storeName: string
  day: Date
  quantity: number | null
  stockStatus: StockStatus
}

/** Daily reading history for one SKU across the org's activated stores. */
export async function getSkuTrend(
  organisationId: string,
  skuId: string,
  days = 28,
): Promise<TrendPoint[]> {
  return db.$queryRaw<TrendPoint[]>(Prisma.sql`
    SELECT
      sr."storeId"     AS "storeId",
      st.name          AS "storeName",
      sr."recordedAt"  AS "day",
      sr.quantity      AS "quantity",
      sr."stockStatus" AS "stockStatus"
    FROM "StockReading" sr
    JOIN "Sku" s    ON s.id = sr."skuId"
    JOIN "Store" st ON st.id = sr."storeId"
    JOIN "OrganisationChainLink" ocl
      ON ocl."retailChainId" = st."retailChainId"
     AND ocl."organisationId" = s."organisationId"
     AND ocl."isActive" = true
    WHERE s."organisationId" = ${organisationId}
      AND sr."skuId" = ${skuId}
      AND sr."recordedAt" > now() - make_interval(days => ${days})
    ORDER BY sr."recordedAt" ASC
  `)
}

export type AlertRow = {
  skuId: string
  skuName: string
  storeId: string
  storeName: string
  chainName: string
  quantity: number | null
  stockStatus: StockStatus
  recordedAt: Date
  daysOutLast28: number
  unitPrice: string | null
  marginRate: string | null
  avgWeeklyVelocity: string | null
  /** Estimated lost sales in the org's currency; null when inputs missing. */
  estimatedLostSales: number | null
}

/**
 * Stores × SKUs currently LOW/OUT, with a rough lost-sales estimate:
 * weeksOutOfStock(last 28d) × avgWeeklyVelocity × unitPrice × marginRate.
 */
export async function getAlerts(organisationId: string): Promise<AlertRow[]> {
  const rows = await db.$queryRaw<Omit<AlertRow, 'estimatedLostSales'>[]>(Prisma.sql`
    WITH latest AS (
      SELECT DISTINCT ON (sr."skuId", sr."storeId")
        sr."skuId", sr."storeId", sr.quantity, sr."stockStatus", sr."recordedAt"
      FROM "StockReading" sr
      JOIN "Sku" s    ON s.id = sr."skuId"
      JOIN "Store" st ON st.id = sr."storeId"
      JOIN "OrganisationChainLink" ocl
        ON ocl."retailChainId" = st."retailChainId"
       AND ocl."organisationId" = s."organisationId"
       AND ocl."isActive" = true
      WHERE s."organisationId" = ${organisationId}
        AND s."isActive" = true
        AND st."isActive" = true
      ORDER BY sr."skuId", sr."storeId", sr."recordedAt" DESC
    ),
    out_days AS (
      SELECT sr."skuId", sr."storeId",
             COUNT(DISTINCT date_trunc('day', sr."recordedAt")) AS days_out
      FROM "StockReading" sr
      JOIN "Sku" s ON s.id = sr."skuId"
      WHERE s."organisationId" = ${organisationId}
        AND sr."stockStatus" = 'OUT_OF_STOCK'::"StockStatus"
        AND sr."recordedAt" > now() - interval '28 days'
      GROUP BY sr."skuId", sr."storeId"
    )
    SELECT
      l."skuId"        AS "skuId",
      s.name           AS "skuName",
      l."storeId"      AS "storeId",
      st.name          AS "storeName",
      rc.name          AS "chainName",
      l.quantity       AS "quantity",
      l."stockStatus"  AS "stockStatus",
      l."recordedAt"   AS "recordedAt",
      COALESCE(od.days_out, 0)::int AS "daysOutLast28",
      s."unitPrice"::text          AS "unitPrice",
      s."marginRate"::text         AS "marginRate",
      s."avgWeeklyVelocity"::text  AS "avgWeeklyVelocity"
    FROM latest l
    JOIN "Sku" s    ON s.id = l."skuId"
    JOIN "Store" st ON st.id = l."storeId"
    JOIN "RetailChain" rc ON rc.id = st."retailChainId"
    LEFT JOIN out_days od ON od."skuId" = l."skuId" AND od."storeId" = l."storeId"
    WHERE l."stockStatus" IN ('LOW_STOCK'::"StockStatus", 'OUT_OF_STOCK'::"StockStatus")
  `)

  return rows
    .map((r) => {
      const price = r.unitPrice ? parseFloat(r.unitPrice) : null
      const margin = r.marginRate ? parseFloat(r.marginRate) : null
      const velocity = r.avgWeeklyVelocity ? parseFloat(r.avgWeeklyVelocity) : null
      const estimatedLostSales =
        price != null && margin != null && velocity != null
          ? Math.round((r.daysOutLast28 / 7) * velocity * price * margin)
          : null
      return { ...r, estimatedLostSales }
    })
    .sort((a, b) => (b.estimatedLostSales ?? -1) - (a.estimatedLostSales ?? -1))
}
