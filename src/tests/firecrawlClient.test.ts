/**
 * Firecrawl Client — Unit Tests
 * Çalıştırma: npx tsx src/tests/firecrawlClient.test.ts
 * Dış HTTP çağrıları global.fetch monkey-patch ile mock'lanır (gerçek kredi harcanmaz).
 */
import assert from 'assert'
import { isFirecrawlReady, firecrawlMap, firecrawlScrape } from '../../lib/firecrawl/client'

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
function mockFetch(handler: (url: string, init: RequestInit) => { ok: boolean; status?: number; json: unknown }): void {
  // @ts-expect-error test override
  global.fetch = async (url: string, init: RequestInit) => {
    const r = handler(String(url), init)
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.json,
    } as Response
  }
}
function restoreFetch(): void {
  global.fetch = realFetch
}

test('isFirecrawlReady: key yok → false', () => {
  delete process.env.FIRECRAWL_API_KEY
  process.env.FIRECRAWL_ENABLED = 'true'
  assert.strictEqual(isFirecrawlReady(), false)
})

test('isFirecrawlReady: flag kapalı → false', () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'false'
  assert.strictEqual(isFirecrawlReady(), false)
})

test('isFirecrawlReady: key var + flag açık → true', () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'true'
  assert.strictEqual(isFirecrawlReady(), true)
})

test('firecrawlMap: links objelerini normalize eder', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({
    ok: true,
    json: { success: true, links: [{ url: 'https://x.com/a' }, { url: 'https://x.com/b', title: 'B' }] },
  }))
  const links = await firecrawlMap('https://x.com')
  restoreFetch()
  assert.strictEqual(links.length, 2)
  assert.strictEqual(links[0].url, 'https://x.com/a')
})

test('firecrawlMap: links string dizisini de kabul eder', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({ ok: true, json: { success: true, links: ['https://x.com/a'] } }))
  const links = await firecrawlMap('https://x.com')
  restoreFetch()
  assert.strictEqual(links[0].url, 'https://x.com/a')
})

test('firecrawlScrape: markdown + metadata çıkarır', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({
    ok: true,
    json: { success: true, data: { markdown: '# Merhaba', metadata: { title: 'T', description: 'D' } } },
  }))
  const page = await firecrawlScrape('https://x.com')
  restoreFetch()
  assert.ok(page)
  assert.strictEqual(page!.markdown, '# Merhaba')
  assert.strictEqual(page!.title, 'T')
  assert.strictEqual(page!.description, 'D')
})

test('firecrawlScrape: metadata title dizi ise ilkini alır', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({
    ok: true,
    json: { success: true, data: { markdown: 'x', metadata: { title: ['T1', 'T2'] } } },
  }))
  const page = await firecrawlScrape('https://x.com')
  restoreFetch()
  assert.strictEqual(page!.title, 'T1')
})

test('firecrawlScrape: markdown yoksa null', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({ ok: true, json: { success: true, data: { metadata: {} } } }))
  const page = await firecrawlScrape('https://x.com')
  restoreFetch()
  assert.strictEqual(page, null)
})

test('firecrawlMap: HTTP 429 → hata fırlatır', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({ ok: false, status: 429, json: {} }))
  await assert.rejects(() => firecrawlMap('https://x.com'), /firecrawl_http_429/)
  restoreFetch()
})

async function runAll(): Promise<void> {
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}
runAll()
