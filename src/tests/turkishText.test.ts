/**
 * Türkçe metin util — Unit Tests
 * Çalıştırma: npx tsx src/tests/turkishText.test.ts
 */
import assert from 'assert'
import { normalizeTrLower, cityIncludes } from '../../lib/yoai/turkishText'

let passed = 0
let failed = 0
const queue: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  queue.push(async () => {
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

test('normalizeTrLower: büyük İ → istanbul (combining dot yok)', () => {
  const n = normalizeTrLower('İstanbul')
  assert.strictEqual(n, 'istanbul')
  assert.ok(n.includes('istanbul'))
})

test('normalizeTrLower: ISTANBUL (tüm büyük) → istanbul', () => {
  assert.strictEqual(normalizeTrLower('ISTANBUL'), 'istanbul')
})

test('normalizeTrLower: küçük istanbul değişmez', () => {
  assert.strictEqual(normalizeTrLower('istanbul'), 'istanbul')
})

test('cityIncludes: büyük İ ile İstanbul yakalanır (eski bug)', () => {
  assert.strictEqual(cityIncludes('İstanbul avukatlık hizmetleri', 'istanbul'), true)
})

test('cityIncludes: ISTANBUL ve istanbul de yakalanır', () => {
  assert.strictEqual(cityIncludes('ISTANBUL merkez', 'istanbul'), true)
  assert.strictEqual(cityIncludes('istanbul merkez', 'istanbul'), true)
})

test('cityIncludes: ilgisiz metin false', () => {
  assert.strictEqual(cityIncludes('Ankara ofisimiz', 'istanbul'), false)
})

test('cityIncludes: Ankara (özel-harfsiz) sorunsuz', () => {
  assert.strictEqual(cityIncludes('İstanbul ve Ankara', 'ankara'), true)
})

test('cityIncludes: boş/null güvenli', () => {
  assert.strictEqual(cityIncludes('', 'istanbul'), false)
  assert.strictEqual(cityIncludes(null, 'istanbul'), false)
})

;(async () => {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız`)
  if (failed > 0) process.exit(1)
})()
