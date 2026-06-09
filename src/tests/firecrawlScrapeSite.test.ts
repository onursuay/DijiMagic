/**
 * Firecrawl scrapeSite — Unit Tests
 * Çalıştırma: npx tsx src/tests/firecrawlScrapeSite.test.ts
 * global.fetch monkey-patch ile map/scrape mock'lanır.
 */
import assert from 'assert'
import { scrapeSite } from '../../lib/firecrawl/scrapeSite'

let passed = 0
let failed = 0
const pending: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  pending.push(async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
      passed++
    } catch (e) {
      console.error(`  ✗ ${name}`)
      console.error(`    ${e instanceof Error ? e.message : e}`)
      failed++
    }
  })
}

const realFetch = global.fetch
// handler hedef sayfa URL'ini POST body'sinden (bodyUrl) alır — Firecrawl çağrısında
// fetch URL'i her zaman API endpoint'idir, hedef sayfa body'dedir.
function mockFetch(handler: (url: string, bodyUrl: string) => { ok: boolean; status?: number; json: unknown }): void {
  // @ts-expect-error test override
  global.fetch = async (url: string, init: RequestInit) => {
    let bodyUrl = ''
    try {
      bodyUrl = JSON.parse(String(init?.body || '{}')).url || ''
    } catch {
      bodyUrl = ''
    }
    const r = handler(String(url), bodyUrl)
    return { ok: r.ok, status: r.status ?? (r.ok ? 200 : 500), json: async () => r.json } as Response
  }
}
function restoreFetch(): void {
  global.fetch = realFetch
}

function defaultHandler(url: string, bodyUrl: string): { ok: boolean; json: unknown } {
  if (url.includes('/v2/map')) {
    return { ok: true, json: { success: true, links: [{ url: 'https://x.com/hizmetler' }] } }
  }
  // scrape
  return { ok: true, json: { success: true, data: { markdown: `İçerik: ${bodyUrl}`, metadata: { title: 'T', description: 'D' } } } }
}

test('map + scrape → birleşik markdown döner', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(defaultHandler)
  const result = await scrapeSite('https://x.com')
  restoreFetch()
  assert.ok(result)
  assert.strictEqual(result!.pagesScanned, 2) // anasayfa + hizmetler
  assert.ok(result!.markdown.includes('İçerik: https://x.com'))
  assert.strictEqual(result!.title, 'T')
})

test("tüm scrape başarısız → null (çağıran HTTP fetch'e düşer)", async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch((url) => {
    if (url.includes('/v2/map')) return { ok: true, json: { success: true, links: [] } }
    return { ok: true, json: { success: true, data: { metadata: {} } } } // markdown yok
  })
  const result = await scrapeSite('https://x.com')
  restoreFetch()
  assert.strictEqual(result, null)
})

test('deadline geçmişte → truncated, sadece eldekiyle biter', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(defaultHandler)
  const pastDeadline = Date.now() - 1000
  const result = await scrapeSite('https://x.com', pastDeadline)
  restoreFetch()
  // map çalışır ama hiçbir sayfa scrape edilmez → pagesScanned 0 → null
  assert.strictEqual(result, null)
})

test('map hata verse bile anasayfa scrape edilir', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch((url) => {
    if (url.includes('/v2/map')) return { ok: false, status: 500, json: {} }
    return { ok: true, json: { success: true, data: { markdown: 'home', metadata: { title: 'H' } } } }
  })
  const result = await scrapeSite('https://x.com')
  restoreFetch()
  assert.ok(result)
  assert.strictEqual(result!.pagesScanned, 1)
  assert.ok(result!.markdown.includes('home'))
})

async function runAll(): Promise<void> {
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}
runAll()
