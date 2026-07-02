/**
 * Chain investigation probe — run this from YOUR OWN machine (it needs open
 * internet access, which the development sandbox doesn't have):
 *
 *   node scripts/probe-chain.mjs jernia <internal-product-code>
 *   node scripts/probe-chain.mjs cg
 *
 * It prints what each endpoint returns so we can confirm (or correct) the
 * assumptions in src/lib/scraper/adapters/ before enabling a chain.
 * Paste the full output back into the Claude session.
 */

const [, , chain, productCode] = process.argv

const UA = 'LerkeStockMonitor/1.0 (inventory monitoring on behalf of distributors)'

async function probe(label, url, headers = {}) {
  process.stdout.write(`\n=== ${label}\nGET ${url}\n`)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json, text/html;q=0.5', 'User-Agent': UA, ...headers },
      signal: AbortSignal.timeout(20000),
    })
    const type = res.headers.get('content-type') ?? '?'
    const body = await res.text()
    console.log(`status: ${res.status} · content-type: ${type} · bytes: ${body.length}`)
    console.log(body.slice(0, 2000))
    if (body.length > 2000) console.log(`... (${body.length - 2000} more bytes)`)
  } catch (e) {
    console.log(`ERROR: ${e.message}`)
  }
}

if (chain === 'jernia') {
  const code = productCode ?? '' // Jernia's INTERNAL product code, not EAN
  // A1: baseSiteId assumed "jernia"
  await probe('Product search (verifies A1 + anonymous access A4)',
    'https://ecommerce.jernia.no/rest/v2/jernia/products/search?query=hammer&pageSize=2&fields=DEFAULT')
  if (code) {
    await probe('Product detail',
      `https://ecommerce.jernia.no/rest/v2/jernia/products/${encodeURIComponent(code)}?fields=FULL`)
    // A2/A3/A5: standard OCC stock-per-store endpoint
    await probe('Store stock (verifies A2 shape, A3 store ids, A5 status values)',
      `https://ecommerce.jernia.no/rest/v2/jernia/products/${encodeURIComponent(code)}/stock?location=Oslo&pageSize=20&fields=FULL`)
  } else {
    console.log('\n(no product code given — rerun with a known Jernia internal product code to probe stock)')
  }
  // Store directory
  await probe('Store list', 'https://ecommerce.jernia.no/rest/v2/jernia/stores?pageSize=5&fields=DEFAULT')
} else if (chain === 'cg') {
  await probe('Homepage (identify platform from markup)', 'https://www.cg.no/')
  await probe('Shopify products.json probe', 'https://www.cg.no/products.json?limit=1')
  await probe('robots.txt (often reveals platform + API paths)', 'https://www.cg.no/robots.txt')
} else {
  console.log('Usage: node scripts/probe-chain.mjs <jernia|cg> [productCode]')
  process.exit(1)
}
