'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { executeScrapeRun } from '@/lib/scraper'

export type TriggerScrapeState = { error?: string; runId?: string }

/**
 * Manual scrape for one chain, admin-only, scoped to the caller's
 * organisation. Refuses chains the organisation has not activated —
 * the same OrganisationChainLink gate the cron uses.
 */
export async function triggerScrape(retailChainId: string): Promise<TriggerScrapeState> {
  const user = await requireAdmin()

  const link = await db.organisationChainLink.findUnique({
    where: {
      organisationId_retailChainId: {
        organisationId: user.organisationId,
        retailChainId,
      },
    },
    include: { retailChain: true },
  })
  if (!link?.isActive) return { error: 'Your organisation has not activated this chain.' }
  if (!link.retailChain.isEnabled) {
    return { error: `${link.retailChain.name} is temporarily disabled platform-wide.` }
  }

  const run = await db.scrapeRun.create({
    data: {
      retailChainId,
      organisationId: user.organisationId,
      trigger: 'MANUAL',
    },
  })

  // Runs inline; per-item errors land in ScrapeRun.errorSummary.
  await executeScrapeRun(run.id)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings/chains')
  return { runId: run.id }
}
