/**
 * Dev smoke test: runs the daily scrape pipeline against the local database
 * and prints what happened. Run with: npx tsx scripts/smoke-scrape.ts
 *
 * Expects the DB to be seeded (npm run db:seed). Verifies the opt-in rule:
 * only chains with an active OrganisationChainLink get a ScrapeRun — the
 * seeded Jernia chain (no links, disabled) must NOT appear.
 */
import 'dotenv/config'
import { db } from '../src/lib/db'
import { runDailyScrapes } from '../src/lib/scraper'
import { getAlerts, getStockMatrix } from '../src/lib/queries/stock'

async function main() {
  const before = await db.stockReading.count()
  const results = await runDailyScrapes()
  console.log('cron scraped chains:', results.map((r) => r.chainSlug).join(', ') || '(none)')

  if (results.some((r) => r.chainSlug === 'jernia')) {
    throw new Error('OPT-IN VIOLATION: jernia has no active OrganisationChainLink but was scraped')
  }

  for (const r of results) {
    const run = await db.scrapeRun.findUniqueOrThrow({ where: { id: r.runId } })
    console.log(
      `  ${r.chainSlug}: ${run.status}, ${run.readingsCount} readings`,
      run.errorSummary ? JSON.stringify(run.errorSummary).slice(0, 120) : '',
    )
  }
  const after = await db.stockReading.count()
  console.log(`stock readings: ${before} -> ${after}`)

  const org = await db.organisation.findFirstOrThrow({ where: { slug: 'fjellrev' } })
  const matrix = await getStockMatrix(org.id)
  const alerts = await getAlerts(org.id)
  console.log(`matrix cells: ${matrix.length} (expect 6 SKUs × 5 stores = 30)`)
  console.log(`alerts: ${alerts.length}, top:`, alerts[0]
    ? `${alerts[0].skuName} @ ${alerts[0].storeName} — est. lost ${alerts[0].estimatedLostSales}`
    : '(none)')

  if (matrix.length !== 30) throw new Error(`expected 30 matrix cells, got ${matrix.length}`)
  if (after <= before) throw new Error('scrape produced no new readings')
  console.log('SMOKE PASSED')
}

main()
  .catch((e) => {
    console.error('SMOKE FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
