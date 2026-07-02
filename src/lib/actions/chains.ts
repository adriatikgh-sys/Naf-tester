'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export type ChainActionState = { error?: string; ok?: boolean }

/**
 * Activate/deactivate a retail chain for the admin's organisation.
 * OrganisationChainLink is the opt-in source of truth: scrape jobs only ever
 * see chains that have at least one active link.
 */
export async function setChainActivation(
  retailChainId: string,
  isActive: boolean,
): Promise<ChainActionState> {
  const user = await requireAdmin()

  const chain = await db.retailChain.findUnique({ where: { id: retailChainId } })
  if (!chain) return { error: 'Chain not found.' }

  await db.organisationChainLink.upsert({
    where: {
      organisationId_retailChainId: {
        organisationId: user.organisationId,
        retailChainId,
      },
    },
    create: {
      organisationId: user.organisationId,
      retailChainId,
      isActive,
    },
    update: isActive
      ? { isActive: true, activatedAt: new Date(), deactivatedAt: null }
      : { isActive: false, deactivatedAt: new Date() },
  })

  revalidatePath('/dashboard/settings/chains')
  revalidatePath('/dashboard')
  return { ok: true }
}
