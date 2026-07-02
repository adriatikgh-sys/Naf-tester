'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

const storeSchema = z.object({
  retailChainId: z.string().min(1),
  externalId: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  city: z.string().trim().max(120).optional().or(z.literal('').transform(() => undefined)),
  countryCode: z.string().trim().toUpperCase().length(2).default('NO'),
})

export type StoreActionState = { error?: string; ok?: boolean }

/**
 * Stores are shared reference data (they belong to the chain, not the tenant),
 * but adding one is restricted to admins of organisations that activated the
 * chain — you can't extend chains you don't use.
 */
export async function createStore(_prev: StoreActionState, formData: FormData): Promise<StoreActionState> {
  const user = await requireAdmin()
  const parsed = storeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const link = await db.organisationChainLink.findUnique({
    where: {
      organisationId_retailChainId: {
        organisationId: user.organisationId,
        retailChainId: parsed.data.retailChainId,
      },
    },
  })
  if (!link?.isActive) return { error: 'Activate this chain first.' }

  try {
    await db.store.create({ data: parsed.data })
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return { error: 'A store with this ID already exists for the chain.' }
    }
    throw e
  }
  revalidatePath('/dashboard/stores')
  return { ok: true }
}
