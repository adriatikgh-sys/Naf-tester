/**
 * Seed data for local development: one demo organisation with an admin user,
 * two FICTIONAL retail chains (so nobody mistakes seed data for a verified
 * integration), stores, SKUs, chain mappings, and three weeks of stock
 * readings with visible trends: healthy stock, declining velocity, and a
 * recurring stockout.
 *
 * Run with: npm run db:seed   (or npx prisma db seed)
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, StockStatus } from '../src/generated/prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

// Deterministic pseudo-random so re-seeding produces the same picture.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260702)

function statusFor(quantity: number, threshold: number): StockStatus {
  if (quantity <= 0) return StockStatus.OUT_OF_STOCK
  if (quantity <= threshold) return StockStatus.LOW_STOCK
  return StockStatus.IN_STOCK
}

async function main() {
  console.log('Clearing existing data...')
  // Order matters: children before parents.
  await db.emailDraftSku.deleteMany()
  await db.emailDraft.deleteMany()
  await db.stockReading.deleteMany()
  await db.scrapeRun.deleteMany()
  await db.skuChainMapping.deleteMany()
  await db.sku.deleteMany()
  await db.organisationChainLink.deleteMany()
  await db.store.deleteMany()
  await db.retailChain.deleteMany()
  await db.user.deleteMany()
  await db.organisation.deleteMany()

  console.log('Creating organisation + admin user...')
  const org = await db.organisation.create({
    data: {
      name: 'Fjellrev Distribusjon AS',
      slug: 'fjellrev',
      currencyCode: 'NOK',
      locale: 'nb-NO',
      defaultLowStockThreshold: 5,
    },
  })

  await db.user.create({
    data: {
      email: 'admin@fjellrev.example',
      name: 'Astrid Admin',
      passwordHash: await bcrypt.hash('demo-passord-123', 10),
      role: 'ADMIN',
      organisationId: org.id,
    },
  })

  console.log('Creating fictional retail chains + stores...')
  const nordvare = await db.retailChain.create({
    data: {
      name: 'Nordvare (demo)',
      slug: 'nordvare-demo',
      websiteUrl: 'https://nordvare.example',
      countryCode: 'NO',
      dataSourceType: 'API',
      notes: 'Fictional chain for seed/demo data only.',
    },
  })
  const husoghage = await db.retailChain.create({
    data: {
      name: 'Hus & Hage (demo)',
      slug: 'hus-og-hage-demo',
      websiteUrl: 'https://husoghage.example',
      countryCode: 'NO',
      dataSourceType: 'SCRAPE_STATIC',
      notes: 'Fictional chain for seed/demo data only.',
    },
  })

  const storeSpecs = [
    { chain: nordvare, externalId: 'NV-001', name: 'Nordvare Oslo Storo', city: 'Oslo' },
    { chain: nordvare, externalId: 'NV-014', name: 'Nordvare Bergen Lagunen', city: 'Bergen' },
    { chain: nordvare, externalId: 'NV-022', name: 'Nordvare Trondheim City Syd', city: 'Trondheim' },
    { chain: husoghage, externalId: 'HH-3', name: 'Hus & Hage Sandvika', city: 'Sandvika' },
    { chain: husoghage, externalId: 'HH-9', name: 'Hus & Hage Stavanger', city: 'Stavanger' },
  ]
  const stores = []
  for (const s of storeSpecs) {
    stores.push(
      await db.store.create({
        data: {
          retailChainId: s.chain.id,
          externalId: s.externalId,
          name: s.name,
          city: s.city,
          countryCode: 'NO',
        },
      }),
    )
  }

  console.log('Activating both chains for the demo organisation...')
  for (const chain of [nordvare, husoghage]) {
    await db.organisationChainLink.create({
      data: { organisationId: org.id, retailChainId: chain.id },
    })
  }

  console.log('Creating SKUs + chain mappings...')
  const skuSpecs = [
    // profile: 'healthy' | 'declining' | 'stockout'
    { name: 'Fjellrev Termokopp 450ml', ean: '7090000000011', price: 249, margin: 0.42, velocity: 6, profile: 'healthy' },
    { name: 'Fjellrev Stormkjøkken Kompakt', ean: '7090000000028', price: 899, margin: 0.38, velocity: 2, profile: 'declining' },
    { name: 'Fjellrev Ullsokker 3-pk', ean: '7090000000035', price: 199, margin: 0.55, velocity: 12, profile: 'stockout' },
    { name: 'Fjellrev Hodelykt 600lm', ean: '7090000000042', price: 549, margin: 0.45, velocity: 4, profile: 'healthy' },
    { name: 'Fjellrev Turkniv Birk', ean: '7090000000059', price: 429, margin: 0.5, velocity: 3, profile: 'declining' },
    { name: 'Fjellrev Vannflaske Stål 1L', ean: '7090000000066', price: 329, margin: 0.48, velocity: 8, profile: 'stockout' },
  ]

  const skus: { id: string; profile: string; velocity: number }[] = []
  for (const [i, s] of skuSpecs.entries()) {
    const sku = await db.sku.create({
      data: {
        organisationId: org.id,
        name: s.name,
        ean: s.ean,
        internalCode: `FJ-${1001 + i}`,
        unitPrice: s.price,
        currencyCode: 'NOK',
        marginRate: s.margin,
        avgWeeklyVelocity: s.velocity,
      },
    })
    skus.push({ id: sku.id, profile: s.profile, velocity: s.velocity })
    for (const chain of [nordvare, husoghage]) {
      await db.skuChainMapping.create({
        data: {
          skuId: sku.id,
          retailChainId: chain.id,
          externalProductId: `${chain.slug === 'nordvare-demo' ? 'P' : 'ART'}${700000 + i * 37}`,
        },
      })
    }
  }

  console.log('Generating 21 days of stock readings...')
  const threshold = 5
  const now = new Date()
  const readings: {
    skuId: string
    storeId: string
    quantity: number
    stockStatus: StockStatus
    recordedAt: Date
  }[] = []

  for (const sku of skus) {
    for (const store of stores) {
      // Starting stock differs a bit per store.
      let level = 12 + Math.floor(rand() * 20)
      for (let day = 21; day >= 0; day--) {
        const date = new Date(now.getTime() - day * 24 * 3600 * 1000)
        const dailySales =
          sku.profile === 'healthy'
            ? rand() * (sku.velocity / 7) * 1.2
            : sku.profile === 'declining'
              ? rand() * (sku.velocity / 7) * (0.6 + ((21 - day) / 21) * 1.6) // sales speed up, stock drains
              : rand() * (sku.velocity / 7) * 2.2 // stockout profile drains fast
        level -= dailySales
        // Healthy SKUs get restocked when low; stockout profile only sometimes.
        if (level <= threshold) {
          const restockChance = sku.profile === 'healthy' ? 0.9 : sku.profile === 'declining' ? 0.5 : 0.15
          if (rand() < restockChance) level = 15 + rand() * 15
        }
        const qty = Math.max(0, Math.round(level))
        readings.push({
          skuId: sku.id,
          storeId: store.id,
          quantity: qty,
          stockStatus: statusFor(qty, threshold),
          recordedAt: date,
        })
      }
    }
  }
  await db.stockReading.createMany({ data: readings })

  console.log(
    `Seeded: 1 org, 1 admin (admin@fjellrev.example / demo-passord-123), 2 chains, ${stores.length} stores, ${skus.length} SKUs, ${readings.length} stock readings.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
