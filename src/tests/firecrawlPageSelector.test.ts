/**
 * Firecrawl pageSelector — Unit Tests
 * Çalıştırma: npx tsx src/tests/firecrawlPageSelector.test.ts
 */
import assert from 'assert'
import { selectKeyPages } from '../../lib/firecrawl/pageSelector'
import type { MapLink } from '../../lib/firecrawl/types'

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

const links: MapLink[] = [
  { url: 'https://x.com/blog/yazi-1' },
  { url: 'https://x.com/iletisim' },
  { url: 'https://x.com/hizmetler' },
  { url: 'https://x.com/hakkimizda' },
  { url: 'https://x.com/fiyatlandirma' },
  { url: 'https://x.com/blog/yazi-2' },
]

test('anasayfa her zaman ilk sırada', () => {
  const pages = selectKeyPages('https://x.com', links, 6)
  assert.strictEqual(pages[0], 'https://x.com')
})

test('öncelik sırası: hakkımızda > hizmetler > fiyat > iletişim > diğer', () => {
  const pages = selectKeyPages('https://x.com', links, 6)
  // anasayfa(0), hakkimizda(1), hizmetler(2), fiyatlandirma(3), iletisim(4), blog(99)
  assert.deepStrictEqual(pages.slice(0, 5), [
    'https://x.com',
    'https://x.com/hakkimizda',
    'https://x.com/hizmetler',
    'https://x.com/fiyatlandirma',
    'https://x.com/iletisim',
  ])
})

test('max sınırına uyar', () => {
  const pages = selectKeyPages('https://x.com', links, 3)
  assert.strictEqual(pages.length, 3)
})

test('duplicate path elenir', () => {
  const dupLinks: MapLink[] = [{ url: 'https://x.com/' }, { url: 'https://x.com/hizmetler' }, { url: 'https://x.com/hizmetler' }]
  const pages = selectKeyPages('https://x.com', dupLinks, 6)
  const hizmetCount = pages.filter((p) => p.includes('hizmetler')).length
  assert.strictEqual(hizmetCount, 1)
})

test('boş links → sadece anasayfa', () => {
  const pages = selectKeyPages('https://x.com', [], 6)
  assert.deepStrictEqual(pages, ['https://x.com'])
})

async function runAll(): Promise<void> {
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}
runAll()
