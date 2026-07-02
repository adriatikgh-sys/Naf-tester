import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { AddStoreForm } from './add-store-form'

export default async function StoresPage() {
  const user = await requireSession()

  const chains = await db.retailChain.findMany({
    where: { orgLinks: { some: { organisationId: user.organisationId, isActive: true } } },
    include: { stores: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  })

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">Stores</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">
        Stores of your activated chains. Store lists are usually filled by the
        chain integration itself; add missing ones manually if needed.
      </p>

      {user.role === 'ADMIN' && chains.length > 0 && (
        <AddStoreForm chains={chains.map((c) => ({ id: c.id, name: c.name }))} />
      )}

      {chains.length === 0 && (
        <div className="rounded-lg border border-zinc-200 p-8 text-center text-sm text-zinc-600">
          No chains activated yet — pick your chains under Chains.
        </div>
      )}

      <div className="mt-6 space-y-6">
        {chains.map((chain) => (
          <section key={chain.id} className="rounded-lg border border-zinc-200">
            <header className="border-b border-zinc-100 px-4 py-3">
              <h2 className="font-semibold">{chain.name}</h2>
              <p className="text-xs text-zinc-500">{chain.stores.length} stores</p>
            </header>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Store</th>
                  <th className="px-4 py-2">Chain store ID</th>
                  <th className="px-4 py-2">City</th>
                  <th className="px-4 py-2">Country</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {chain.stores.map((store) => (
                  <tr key={store.id}>
                    <td className="px-4 py-2">{store.name}</td>
                    <td className="px-4 py-2 tabular-nums text-zinc-600">{store.externalId}</td>
                    <td className="px-4 py-2">{store.city ?? '—'}</td>
                    <td className="px-4 py-2">{store.countryCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </main>
  )
}
