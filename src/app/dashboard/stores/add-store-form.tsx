'use client'

import { useActionState } from 'react'
import { createStore, type StoreActionState } from '@/lib/actions/stores'

const inputClass =
  'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600'

export function AddStoreForm({ chains }: { chains: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<StoreActionState, FormData>(createStore, {})

  return (
    <form action={action} className="rounded-lg border border-zinc-200 p-4">
      <h2 className="mb-3 font-semibold">Add store</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium">Chain</label>
          <select name="retailChainId" className={inputClass}>
            {chains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Store name *</label>
          <input name="name" required className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Chain store ID *</label>
          <input name="externalId" required className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">City</label>
          <input name="city" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Country</label>
          <input name="countryCode" defaultValue="NO" maxLength={2} className={inputClass} />
        </div>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="mt-2 text-sm text-emerald-700">Store added.</p>}
      <button
        disabled={pending}
        className="mt-3 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add store'}
      </button>
    </form>
  )
}
