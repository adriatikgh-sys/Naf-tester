import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ChainRow } from './chain-row'

export default async function ChainSettingsPage() {
  const user = await requireSession()
  const isAdmin = user.role === 'ADMIN'

  const [chains, links, lastRuns] = await Promise.all([
    db.retailChain.findMany({ orderBy: { name: 'asc' } }),
    db.organisationChainLink.findMany({ where: { organisationId: user.organisationId } }),
    db.scrapeRun.findMany({
      where: {
        OR: [{ organisationId: user.organisationId }, { organisationId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])
  const linkByChain = new Map(links.map((l) => [l.retailChainId, l]))
  const lastRunByChain = new Map<string, (typeof lastRuns)[number]>()
  for (const run of lastRuns) {
    if (!lastRunByChain.has(run.retailChainId)) lastRunByChain.set(run.retailChainId, run)
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Retail chains</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">
        Activate the chains your organisation sells through. Lerke only collects
        stock data for activated chains — nothing is fetched on your behalf from
        chains you leave off.
        {!isAdmin && ' Only admins can change activation.'}
      </p>

      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
        {chains.map((chain) => {
          const link = linkByChain.get(chain.id)
          const lastRun = lastRunByChain.get(chain.id)
          return (
            <ChainRow
              key={chain.id}
              chain={{
                id: chain.id,
                name: chain.name,
                websiteUrl: chain.websiteUrl,
                dataSourceType: chain.dataSourceType,
                isEnabled: chain.isEnabled,
                notes: chain.notes,
              }}
              isActive={link?.isActive ?? false}
              isAdmin={isAdmin}
              lastRun={
                lastRun
                  ? {
                      status: lastRun.status,
                      createdAt: lastRun.createdAt.toISOString(),
                      readingsCount: lastRun.readingsCount,
                    }
                  : null
              }
            />
          )
        })}
      </ul>
    </main>
  )
}
