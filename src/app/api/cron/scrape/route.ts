import { NextResponse } from 'next/server'
import { runDailyScrapes } from '@/lib/scraper'

export const maxDuration = 300 // seconds; requires a Vercel plan that allows it

/**
 * Daily scrape entry point, hit by Vercel Cron (vercel.json).
 * Protected by CRON_SECRET — Vercel sends it as a Bearer token automatically
 * when the env var is set.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const results = await runDailyScrapes()
  return NextResponse.json({ ok: true, runs: results })
}
