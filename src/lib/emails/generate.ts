import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

export type EmailInput = {
  organisationName: string
  storeName: string
  chainName: string
  locale: string // BCP 47 — the language the email should be written in
  currencyCode: string
  senderName: string
  items: {
    skuName: string
    ean: string | null
    quantity: number | null
    stockStatus: string
    daysOutLast28: number
  }[]
}

const emailSchema = z.object({
  subject: z.string(),
  body: z.string(),
})

/**
 * Server-side only — this module must never be imported from a client
 * component (it reads ANTHROPIC_API_KEY).
 *
 * Falls back to a plain template when no API key is configured so the flow
 * stays testable in development.
 */
export async function generateReorderEmail(
  input: EmailInput,
): Promise<{ subject: string; body: string; generatedBy: 'claude' | 'template' }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...templateEmail(input), generatedBy: 'template' }
  }

  const client = new Anthropic()

  const itemLines = input.items
    .map(
      (i) =>
        `- ${i.skuName}${i.ean ? ` (EAN ${i.ean})` : ''}: ` +
        `${i.stockStatus === 'OUT_OF_STOCK' ? 'OUT OF STOCK' : `low (${i.quantity ?? '?'} left)`}` +
        `${i.daysOutLast28 > 0 ? `, out of stock ${i.daysOutLast28} of the last 28 days` : ''}`,
    )
    .join('\n')

  const response = await client.messages.parse({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    system:
      'You draft short, professional reorder emails from a distributor to a retail store manager. ' +
      'Tone: friendly, concrete, helpful — never pushy. The goal is to make restocking easy: ' +
      'name the specific products, their current stock situation, and offer to help with the order. ' +
      'Do not invent prices, order quantities, or delivery dates. Sign with the sender name given. ' +
      'Write the entire email in the language of the given BCP 47 locale.',
    messages: [
      {
        role: 'user',
        content:
          `Locale: ${input.locale}\n` +
          `Distributor: ${input.organisationName}\n` +
          `Sender: ${input.senderName}\n` +
          `Store: ${input.storeName} (${input.chainName})\n` +
          `Products low or out of stock:\n${itemLines}\n\n` +
          'Draft the reorder email.',
      },
    ],
    output_config: { format: zodOutputFormat(emailSchema) },
  })

  const parsed = response.parsed_output
  if (!parsed) {
    return { ...templateEmail(input), generatedBy: 'template' }
  }
  return { subject: parsed.subject, body: parsed.body, generatedBy: 'claude' }
}

/** Deterministic fallback so the feature works without an API key. */
function templateEmail(input: EmailInput): { subject: string; body: string } {
  const lines = input.items.map(
    (i) =>
      `  • ${i.skuName}: ${
        i.stockStatus === 'OUT_OF_STOCK' ? 'out of stock' : `low stock (${i.quantity ?? '?'} left)`
      }`,
  )
  return {
    subject: `Restock reminder — ${input.storeName}`,
    body:
      `Hi,\n\nA quick heads-up from ${input.organisationName}: the following products are running low or out of stock at ${input.storeName}:\n\n` +
      `${lines.join('\n')}\n\n` +
      `Happy to help you get a reorder sorted — just reply to this email.\n\nBest regards,\n${input.senderName}\n${input.organisationName}`,
  }
}
