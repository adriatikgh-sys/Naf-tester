'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { getAlerts } from '@/lib/queries/stock'
import { generateReorderEmail } from '@/lib/emails/generate'

export type EmailActionState = { error?: string; ok?: boolean }

/**
 * Generate an AI reorder email draft for one store, covering all of that
 * store's currently low/out SKUs. The Claude call happens server-side only.
 */
export async function createEmailDraft(storeId: string): Promise<EmailActionState> {
  const user = await requireSession()

  const [org, store] = await Promise.all([
    db.organisation.findUniqueOrThrow({ where: { id: user.organisationId } }),
    db.store.findFirst({
      // Only stores of chains this organisation activated.
      where: {
        id: storeId,
        retailChain: {
          orgLinks: { some: { organisationId: user.organisationId, isActive: true } },
        },
      },
      include: { retailChain: true },
    }),
  ])
  if (!store) return { error: 'Store not found.' }

  const alerts = (await getAlerts(user.organisationId)).filter((a) => a.storeId === storeId)
  if (alerts.length === 0) {
    return { error: 'Nothing is low or out of stock at this store right now.' }
  }

  const generated = await generateReorderEmail({
    organisationName: org.name,
    storeName: store.name,
    chainName: store.retailChain.name,
    locale: org.locale,
    currencyCode: org.currencyCode,
    senderName: user.name,
    items: alerts.map((a) => ({
      skuName: a.skuName,
      ean: null,
      quantity: a.quantity,
      stockStatus: a.stockStatus,
      daysOutLast28: a.daysOutLast28,
    })),
  })

  const draft = await db.emailDraft.create({
    data: {
      organisationId: user.organisationId,
      storeId: store.id,
      createdByUserId: user.id,
      subject: generated.subject,
      body: generated.body,
      language: org.locale,
      skus: {
        create: alerts.map((a) => ({
          skuId: a.skuId,
          quantityAtDraft: a.quantity,
          stockStatusAtDraft: a.stockStatus,
        })),
      },
    },
  })

  revalidatePath('/dashboard/emails')
  redirect(`/dashboard/emails/${draft.id}`)
}

const updateSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
  recipientEmail: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  recipientName: z.string().trim().max(200).optional().or(z.literal('').transform(() => undefined)),
})

export async function updateEmailDraft(
  draftId: string,
  _prev: EmailActionState,
  formData: FormData,
): Promise<EmailActionState> {
  const user = await requireSession()
  const parsed = updateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const res = await db.emailDraft.updateMany({
    where: { id: draftId, organisationId: user.organisationId, status: 'DRAFT' },
    data: parsed.data,
  })
  if (res.count === 0) return { error: 'Draft not found (or already sent).' }
  revalidatePath(`/dashboard/emails/${draftId}`)
  revalidatePath('/dashboard/emails')
  return { ok: true }
}

/**
 * Mark a draft as sent. Lerke doesn't send the email itself (yet) — the user
 * copies it into their mail client; this records that it went out.
 */
export async function markEmailSent(draftId: string): Promise<EmailActionState> {
  const user = await requireSession()
  const res = await db.emailDraft.updateMany({
    where: { id: draftId, organisationId: user.organisationId, status: 'DRAFT' },
    data: { status: 'SENT', sentAt: new Date() },
  })
  if (res.count === 0) return { error: 'Draft not found (or already sent).' }
  revalidatePath(`/dashboard/emails/${draftId}`)
  revalidatePath('/dashboard/emails')
  return { ok: true }
}

export async function deleteEmailDraft(draftId: string): Promise<EmailActionState> {
  const user = await requireSession()
  const res = await db.emailDraft.deleteMany({
    where: { id: draftId, organisationId: user.organisationId },
  })
  if (res.count === 0) return { error: 'Draft not found.' }
  revalidatePath('/dashboard/emails')
  return { ok: true }
}
