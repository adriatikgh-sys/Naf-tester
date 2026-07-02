'use server'

import { revalidatePath } from 'next/cache'
import Papa from 'papaparse'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth'

const skuSchema = z.object({
  name: z.string().trim().min(1).max(200),
  ean: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, 'EAN must be 8–14 digits')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  internalCode: z.string().trim().max(60).optional().or(z.literal('').transform(() => undefined)),
  unitPrice: z.coerce.number().nonnegative().optional(),
  marginRate: z.coerce.number().min(0).max(1).optional(),
  avgWeeklyVelocity: z.coerce.number().nonnegative().optional(),
  lowStockThreshold: z.coerce.number().int().nonnegative().optional(),
})

export type SkuActionState = { error?: string; ok?: boolean }

export async function createSku(_prev: SkuActionState, formData: FormData): Promise<SkuActionState> {
  const user = await requireSession()
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === 'string' && v !== ''),
  )
  const parsed = skuSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const org = await db.organisation.findUniqueOrThrow({ where: { id: user.organisationId } })

  try {
    await db.sku.create({
      data: {
        ...parsed.data,
        organisationId: user.organisationId,
        currencyCode: org.currencyCode,
      },
    })
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return { error: 'A SKU with this EAN already exists in your catalog.' }
    }
    throw e
  }
  revalidatePath('/dashboard/skus')
  return { ok: true }
}

export async function updateSku(
  skuId: string,
  _prev: SkuActionState,
  formData: FormData,
): Promise<SkuActionState> {
  const user = await requireSession()
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === 'string' && v !== ''),
  )
  const parsed = skuSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // updateMany so the organisationId filter is part of the WHERE — a SKU id
  // from another tenant matches zero rows instead of leaking.
  const res = await db.sku.updateMany({
    where: { id: skuId, organisationId: user.organisationId },
    data: parsed.data,
  })
  if (res.count === 0) return { error: 'SKU not found.' }
  revalidatePath('/dashboard/skus')
  return { ok: true }
}

export async function deleteSku(skuId: string): Promise<SkuActionState> {
  const user = await requireSession()
  const res = await db.sku.deleteMany({
    where: { id: skuId, organisationId: user.organisationId },
  })
  if (res.count === 0) return { error: 'SKU not found.' }
  revalidatePath('/dashboard/skus')
  return { ok: true }
}

export async function setSkuChainMapping(
  skuId: string,
  retailChainId: string,
  externalProductId: string,
): Promise<SkuActionState> {
  const user = await requireSession()
  // Verify the SKU belongs to this tenant before touching mappings.
  const sku = await db.sku.findFirst({
    where: { id: skuId, organisationId: user.organisationId },
    select: { id: true },
  })
  if (!sku) return { error: 'SKU not found.' }

  const trimmed = externalProductId.trim()
  if (trimmed === '') {
    await db.skuChainMapping.deleteMany({ where: { skuId, retailChainId } })
  } else {
    await db.skuChainMapping.upsert({
      where: { skuId_retailChainId: { skuId, retailChainId } },
      create: { skuId, retailChainId, externalProductId: trimmed },
      update: { externalProductId: trimmed },
    })
  }
  revalidatePath('/dashboard/skus')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// CSV / Excel import
// ---------------------------------------------------------------------------

export type ImportState = {
  error?: string
  imported?: number
  skipped?: { row: number; reason: string }[]
}

const importRowSchema = skuSchema // same columns as manual entry

type RawRow = Record<string, unknown>

function normaliseHeader(h: string) {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

// Accepted column aliases -> canonical field.
const HEADER_MAP: Record<string, string> = {
  name: 'name',
  navn: 'name',
  produktnavn: 'name',
  ean: 'ean',
  gtin: 'ean',
  strekkode: 'ean',
  internalcode: 'internalCode',
  artikkelnummer: 'internalCode',
  artnr: 'internalCode',
  sku: 'internalCode',
  unitprice: 'unitPrice',
  pris: 'unitPrice',
  price: 'unitPrice',
  marginrate: 'marginRate',
  margin: 'marginRate',
  avgweeklyvelocity: 'avgWeeklyVelocity',
  velocity: 'avgWeeklyVelocity',
  ukessalg: 'avgWeeklyVelocity',
  lowstockthreshold: 'lowStockThreshold',
  threshold: 'lowStockThreshold',
}

function remapRow(row: RawRow): RawRow {
  const out: RawRow = {}
  for (const [k, v] of Object.entries(row)) {
    const field = HEADER_MAP[normaliseHeader(k)]
    if (field && v != null && `${v}`.trim() !== '') out[field] = `${v}`.trim()
  }
  return out
}

async function parseUpload(file: File): Promise<RawRow[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text()
    const result = Papa.parse<RawRow>(text, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', ';', '\t'],
    })
    return result.data
  }
  if (name.endsWith('.xlsx')) {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer())
    const sheet = workbook.worksheets[0]
    if (!sheet) return []
    const headerRow = sheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col] = `${cell.value ?? ''}`
    })
    const rows: RawRow[] = []
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const obj: RawRow = {}
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (headers[col]) obj[headers[col]] = cell.value ?? ''
      })
      rows.push(obj)
    })
    return rows
  }
  throw new Error('UNSUPPORTED_FORMAT')
}

export async function importSkus(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireSession()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV or .xlsx file.' }
  if (file.size > 5 * 1024 * 1024) return { error: 'File too large (max 5 MB).' }

  let rawRows: RawRow[]
  try {
    rawRows = await parseUpload(file)
  } catch (e) {
    return {
      error:
        e instanceof Error && e.message === 'UNSUPPORTED_FORMAT'
          ? 'Unsupported file type — use .csv or .xlsx.'
          : 'Could not parse the file.',
    }
  }
  if (rawRows.length === 0) return { error: 'No data rows found in the file.' }
  if (rawRows.length > 5000) return { error: 'Too many rows (max 5000 per import).' }

  const org = await db.organisation.findUniqueOrThrow({ where: { id: user.organisationId } })

  let imported = 0
  const skipped: { row: number; reason: string }[] = []

  for (const [i, raw] of rawRows.entries()) {
    const rowNumber = i + 2 // 1-based + header row
    const parsed = importRowSchema.safeParse(remapRow(raw))
    if (!parsed.success) {
      skipped.push({ row: rowNumber, reason: parsed.error.issues[0]?.message ?? 'invalid' })
      continue
    }
    const data = parsed.data
    if (!data.name) {
      skipped.push({ row: rowNumber, reason: 'missing name' })
      continue
    }
    if (data.ean) {
      // Upsert by (organisation, EAN) so re-importing an updated catalog works.
      await db.sku.upsert({
        where: { organisationId_ean: { organisationId: user.organisationId, ean: data.ean } },
        create: { ...data, organisationId: user.organisationId, currencyCode: org.currencyCode },
        update: data,
      })
    } else {
      await db.sku.create({
        data: { ...data, organisationId: user.organisationId, currencyCode: org.currencyCode },
      })
    }
    imported++
  }

  revalidatePath('/dashboard/skus')
  return { imported, skipped: skipped.slice(0, 20) }
}
