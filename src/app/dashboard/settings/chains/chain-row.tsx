'use client'

import { useState, useTransition } from 'react'
import { setChainActivation } from '@/lib/actions/chains'
import { triggerScrape } from '@/lib/actions/scrape'

type Props = {
  chain: {
    id: string
    name: string
    websiteUrl: string
    dataSourceType: string
    isEnabled: boolean
    notes: string | null
  }
  isActive: boolean
  isAdmin: boolean
  lastRun: { status: string; createdAt: string; readingsCount: number } | null
}

export function ChainRow({ chain, isActive, isAdmin, lastRun }: Props) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const toggle = () =>
    startTransition(async () => {
      setMessage(null)
      const res = await setChainActivation(chain.id, !isActive)
      if (res.error) setMessage(res.error)
    })

  const scrapeNow = () =>
    startTransition(async () => {
      setMessage(null)
      const res = await triggerScrape(chain.id)
      setMessage(res.error ?? 'Scrape completed — check the dashboard for fresh readings.')
    })

  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{chain.name}</span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
              {chain.dataSourceType.toLowerCase().replace('_', ' ')}
            </span>
            {!chain.isEnabled && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                integration not yet verified
              </span>
            )}
          </div>
          {lastRun && (
            <p className="mt-0.5 text-xs text-zinc-500">
              Last run: {lastRun.status.toLowerCase()} ·{' '}
              {new Date(lastRun.createdAt).toLocaleString()} · {lastRun.readingsCount} readings
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isActive && isAdmin && chain.isEnabled && (
            <button
              onClick={scrapeNow}
              disabled={pending}
              className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              {pending ? 'Working…' : 'Fetch stock now'}
            </button>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={toggle}
              disabled={!isAdmin || pending}
              className="h-4 w-4 accent-emerald-700"
            />
            <span className="text-sm">{isActive ? 'Active' : 'Off'}</span>
          </label>
        </div>
      </div>
      {message && <p className="text-xs text-zinc-600">{message}</p>}
    </li>
  )
}
