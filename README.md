# Lerke

Multi-tenant B2B SaaS that monitors real-time retail inventory across store
chains for distributors and suppliers — catch stockouts early, see the trend,
estimate the lost sales, and send the reorder email before revenue walks away.

## What's inside

- **Stock matrix** — SKU × store grid, colour-coded against a configurable
  low-stock threshold (per organisation, overridable per SKU).
- **Trend lines** — 28-day stock history per SKU across all stores.
- **Alerts** — stores with low/out SKUs, ranked by estimated lost sales
  (days out of stock × weekly velocity × price × margin), in your currency.
- **AI reorder emails** — Claude drafts a personalised email per store
  covering exactly the SKUs that are low/out; you edit and mark as sent.
- **Opt-in chain scraping** — each organisation activates only the chains it
  sells through. The daily cron and manual triggers resolve their work list
  exclusively through `OrganisationChainLink` — chains nobody activated are
  never touched.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), TypeScript | One deployable unit on Vercel — pages, server actions, API routes in one repo |
| Database | Postgres on **Neon** | Vercel's own Postgres offering is Neon under the hood; going direct adds DB branching for preview deployments |
| ORM | Prisma 7 (`@prisma/adapter-pg` driver adapter) | Connection URL lives in `prisma.config.ts` (Prisma 7 convention) |
| Auth | NextAuth (Auth.js v5), credentials + JWT | Keeps organisation + role in our own DB — the same `organisationId` every query filters on. Registration creates the Organisation + first admin |
| Styling | Tailwind CSS 4 | |
| AI | Anthropic API (`claude-opus-4-8`), server-side only | Structured output (subject + body); falls back to a plain template if no API key is set |
| Scraping | Adapter per chain, `fetch` + JSON/cheerio via Vercel Cron | See "Scraper architecture" below |

## Local setup

You need Node.js 20+ and PostgreSQL running locally.

```bash
# 1. Install dependencies
npm install

# 2. Create a local database (once)
#    Creates a 'lerke' user and database in your local Postgres.
psql -U postgres -c "CREATE USER lerke WITH PASSWORD 'lerke_dev' CREATEDB;" \
     -c "CREATE DATABASE lerke OWNER lerke;"

# 3. Configure environment
cp .env.example .env
#    Fill in DATABASE_URL (the local one from step 2 works as-is) and
#    AUTH_SECRET (any long random string; `openssl rand -base64 32` makes one).

# 4. Create the tables and load demo data
npx prisma migrate dev     # applies migrations to your database
npm run db:seed            # demo org, 2 fictional chains, SKUs, 3 weeks of readings

# 5. Run it
npm run dev                # http://localhost:3000
```

Demo login after seeding: `admin@fjellrev.example` / `demo-passord-123`.

Useful commands:

```bash
npm run db:seed                    # reset demo data (wipes existing rows!)
npx tsx scripts/smoke-scrape.ts    # exercise the scrape pipeline end-to-end
npx prisma studio                  # browse the database in a web UI
```

## Environment variables

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (local dev or Neon) |
| `AUTH_SECRET` | yes | Secret for signing session tokens (`openssl rand -base64 32`) |
| `ANTHROPIC_API_KEY` | for AI emails | From console.anthropic.com — without it, email drafts use a plain template |
| `CRON_SECRET` | in production | Random string; Vercel sends it as a Bearer token to the cron route so nobody else can trigger scrapes |

## Deploying to Vercel + Neon

1. **Neon**: create a project at neon.tech, copy the connection string.
2. **Vercel**: import this GitHub repo at vercel.com/new. Every push to `main`
   deploys to production; every PR gets a preview deployment automatically.
3. Set the four environment variables above in Vercel → Project → Settings →
   Environment Variables.
4. Run migrations against Neon once: locally set `DATABASE_URL` to the Neon
   string and run `npx prisma migrate deploy`.
5. The daily scrape is configured in `vercel.json` (04:30 UTC). Vercel calls
   `/api/cron/scrape` with `Authorization: Bearer $CRON_SECRET` automatically
   once `CRON_SECRET` is set.

## Scraper architecture

Vercel serverless functions are fine for **JSON APIs and static HTML** but a
poor fit for headless browsers. So:

- **Default (option a)**: chains whose data source is JSON or parseable HTML
  are scraped in-process by the cron route (`fetch` + parsing, polite
  per-request delays). `RetailChain.dataSourceType` records this per chain
  (`API` / `SCRAPE_STATIC`).
- **Escape hatch (option b)**: if a chain genuinely requires a headless
  browser, it gets `dataSourceType = SCRAPE_BROWSER` and a small always-on
  worker (Railway/Fly.io) that writes into the same Postgres. **No such chain
  is confirmed yet** — this is decided per chain after investigation, never
  assumed.

Adapters live in `src/lib/scraper/adapters/`, keyed by `RetailChain.slug`.
The executor (`src/lib/scraper/index.ts`) enforces the opt-in rule: work lists
come from `SkuChainMapping` rows whose organisation has an active
`OrganisationChainLink` — never from iterating `RetailChain`.

### Chain status

| Chain | Status |
|---|---|
| Jernia | Adapter written against SAP Commerce (Hybris) OCC v2 (`ecommerce.jernia.no/rest/v2/...`, internal product code — **not** EAN). **Unverified** — assumptions A1–A5 are documented in `src/lib/scraper/adapters/jernia.ts` and the chain is seeded with `isEnabled = false` until verified live. |
| Power, Elkjøp, Kitchn, CG, Tilbords, Obs, Apotek 1, Boots, Vitusapotek, Sunkost, Vita, Kicks, Fredrik & Louisa, Bilvakker | Not yet investigated. |

To verify a chain, run the probe from a machine with normal internet access
(the cloud development sandbox blocks retail sites):

```bash
node scripts/probe-chain.mjs jernia <internal-product-code>
node scripts/probe-chain.mjs cg
```

…and share the output. Each adapter is written only after its chain's real
responses have been seen.

## Multi-tenancy

Isolation is enforced at the query layer, not the UI: every query against
tenant-owned tables filters on `organisationId` (see `src/lib/queries/stock.ts`
and the `updateMany`/`deleteMany` guards in `src/lib/actions/`). Stock data is
additionally gated by chain activation, so an organisation never sees readings
from chains it didn't opt into. Currency (ISO 4217) and locale (BCP 47) are
per-organisation — nothing Norwegian is hardcoded in the data model.
