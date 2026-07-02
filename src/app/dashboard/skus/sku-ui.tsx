'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  createSku,
  deleteSku,
  importSkus,
  setSkuChainMapping,
  type ImportState,
  type SkuActionState,
} from '@/lib/actions/skus'

const inputClass =
  'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600'

export function SkuForms() {
  const [createState, createAction, creating] = useActionState<SkuActionState, FormData>(
    createSku,
    {},
  )
  const [importState, importAction, importing] = useActionState<ImportState, FormData>(
    importSkus,
    {},
  )

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-2">
      <form action={createAction} className="rounded-lg border border-zinc-200 p-4">
        <h2 className="mb-3 font-semibold">Add SKU</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium">Name *</label>
            <input name="name" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">EAN</label>
            <input name="ean" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Internal code</label>
            <input name="internalCode" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Unit price</label>
            <input name="unitPrice" type="number" step="0.01" min="0" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Margin (0–1)</label>
            <input name="marginRate" type="number" step="0.01" min="0" max="1" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Weekly sales / store</label>
            <input name="avgWeeklyVelocity" type="number" step="0.1" min="0" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Low-stock threshold</label>
            <input name="lowStockThreshold" type="number" min="0" className={inputClass} />
          </div>
        </div>
        {createState.error && <p className="mt-2 text-sm text-red-600">{createState.error}</p>}
        {createState.ok && <p className="mt-2 text-sm text-emerald-700">SKU added.</p>}
        <button
          disabled={creating}
          className="mt-3 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {creating ? 'Adding…' : 'Add SKU'}
        </button>
      </form>

      <form action={importAction} className="rounded-lg border border-zinc-200 p-4">
        <h2 className="mb-3 font-semibold">Import from CSV / Excel</h2>
        <p className="mb-3 text-xs text-zinc-600">
          Columns (Norwegian or English headers work): name/navn, ean, internal
          code/artikkelnummer, price/pris, margin, velocity/ukessalg, threshold.
          Rows with an EAN that already exists are updated, not duplicated.
        </p>
        <input
          type="file"
          name="file"
          accept=".csv,.txt,.xlsx"
          required
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm"
        />
        {importState.error && <p className="mt-2 text-sm text-red-600">{importState.error}</p>}
        {importState.imported != null && (
          <div className="mt-2 text-sm text-emerald-700">
            Imported {importState.imported} rows.
            {importState.skipped && importState.skipped.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs text-amber-700">
                {importState.skipped.map((s) => (
                  <li key={s.row}>
                    Row {s.row} skipped: {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <button
          disabled={importing}
          className="mt-3 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {importing ? 'Importing…' : 'Import'}
        </button>
      </form>
    </div>
  )
}

type SkuRow = {
  id: string
  name: string
  ean: string | null
  internalCode: string | null
  unitPrice: string | null
  currencyCode: string | null
  marginRate: string | null
  avgWeeklyVelocity: string | null
  lowStockThreshold: number | null
  mappings: Record<string, string>
}

export function SkuTable({
  skus,
  chains,
}: {
  skus: SkuRow[]
  chains: { id: string; name: string }[]
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-600">
          <tr>
            <th className="px-3 py-2">SKU</th>
            <th className="px-3 py-2">EAN</th>
            <th className="px-3 py-2">Price</th>
            <th className="px-3 py-2">Margin</th>
            <th className="px-3 py-2">Velocity</th>
            {chains.map((c) => (
              <th key={c.id} className="px-3 py-2">
                {c.name} ID
              </th>
            ))}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {skus.map((sku) => (
            <SkuTableRow key={sku.id} sku={sku} chains={chains} />
          ))}
          {skus.length === 0 && (
            <tr>
              <td colSpan={6 + chains.length} className="px-3 py-6 text-center text-zinc-500">
                No SKUs yet — add one above or import your catalog.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function SkuTableRow({ sku, chains }: { sku: SkuRow; chains: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition()

  return (
    <tr className={pending ? 'opacity-50' : undefined}>
      <td className="px-3 py-2 font-medium">
        {sku.name}
        {sku.internalCode && <span className="ml-1 text-xs text-zinc-500">({sku.internalCode})</span>}
      </td>
      <td className="px-3 py-2 tabular-nums">{sku.ean ?? '—'}</td>
      <td className="px-3 py-2 tabular-nums">
        {sku.unitPrice ? `${sku.unitPrice} ${sku.currencyCode ?? ''}` : '—'}
      </td>
      <td className="px-3 py-2 tabular-nums">{sku.marginRate ?? '—'}</td>
      <td className="px-3 py-2 tabular-nums">{sku.avgWeeklyVelocity ?? '—'}</td>
      {chains.map((chain) => (
        <td key={chain.id} className="px-3 py-2">
          <MappingCell skuId={sku.id} chainId={chain.id} value={sku.mappings[chain.id] ?? ''} />
        </td>
      ))}
      <td className="px-3 py-2 text-right">
        <button
          onClick={() =>
            startTransition(async () => {
              if (confirm(`Delete "${sku.name}" and all its stock history?`)) {
                await deleteSku(sku.id)
              }
            })
          }
          className="text-xs text-red-600 hover:underline"
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

function MappingCell({ skuId, chainId, value }: { skuId: string; chainId: string; value: string }) {
  const [draft, setDraft] = useState(value)
  const [pending, startTransition] = useTransition()

  const save = () => {
    if (draft === value) return
    startTransition(async () => {
      await setSkuChainMapping(skuId, chainId, draft)
    })
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      placeholder="not mapped"
      disabled={pending}
      className="w-28 rounded border border-zinc-200 px-1.5 py-1 text-xs disabled:opacity-50"
    />
  )
}
