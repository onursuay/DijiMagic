/**
 * CreditRequiredModal — back-compat wrapper testleri.
 *
 * Yeni canonical modal `AccessRequiredModal` (bkz.
 * `src/tests/accessRequiredModal.test.ts`). `CreditRequiredModal`
 * geriye dönük uyumluluk için ince bir wrapper olarak korunur:
 * eski import siteleri bozulmasın diye `type="credit"` ile delege
 * eder. Bu test wrapper'ın delegasyon kontratını korur.
 *
 * Çalıştırma:
 *   npx tsx src/tests/creditRequiredModal.test.ts
 */

import assert from 'assert'
import fs from 'node:fs'
import path from 'node:path'

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

const repoRoot = path.join(__dirname, '..', '..')
const wrapperFile = path.join(repoRoot, 'components', 'billing', 'CreditRequiredModal.tsx')
const accessFile = path.join(repoRoot, 'components', 'billing', 'AccessRequiredModal.tsx')

const wrapperSrc = fs.readFileSync(wrapperFile, 'utf-8')
const accessSrc = fs.readFileSync(accessFile, 'utf-8')

console.log('\n[1] CreditRequiredModal back-compat wrapper')

test('wrapper dosyası mevcut', () => {
  assert.ok(fs.existsSync(wrapperFile), 'CreditRequiredModal.tsx eksik')
})

test('wrapper AccessRequiredModal import ediyor', () => {
  assert.ok(
    /import\s+AccessRequiredModal\s+from\s+['"]\.\/AccessRequiredModal['"]/.test(
      wrapperSrc,
    ),
    'Wrapper AccessRequiredModal import etmiyor',
  )
})

test('wrapper type="credit" ile delege ediyor', () => {
  assert.ok(/type="credit"/.test(wrapperSrc), 'Wrapper type="credit" prop iletmiyor')
})

test('wrapper tüm legacy prop\'ları forward ediyor', () => {
  for (const prop of ['featureName', 'title', 'description', 'ctaLabel', 'reason']) {
    assert.ok(
      new RegExp(`${prop}={?${prop}}?`).test(wrapperSrc) ||
        new RegExp(`${prop}=\\{${prop}\\}`).test(wrapperSrc),
      `Wrapper ${prop} prop'unu forward etmiyor`,
    )
  }
})

test('wrapper requiredPlanLabel → badgeLabel dönüşümü yapıyor', () => {
  assert.ok(
    /badgeLabel=\{requiredPlanLabel\}/.test(wrapperSrc),
    'Wrapper requiredPlanLabel → badgeLabel mapping yok',
  )
})

test('wrapper billingHref → ctaHref dönüşümü yapıyor', () => {
  assert.ok(
    /ctaHref=\{billingHref\}/.test(wrapperSrc),
    'Wrapper billingHref → ctaHref mapping yok',
  )
})

console.log('\n[2] Canonical modal hâlâ kapatma yasağını uyguluyor')

test('AccessRequiredModal kapatma X içermiyor (transitive guarantee)', () => {
  assert.ok(
    !/<X[\s/]/.test(accessSrc) && !/aria-label="Close"/i.test(accessSrc),
    'AccessRequiredModal kapatma butonu içeriyor — wrapper ile geçemez',
  )
})

setTimeout(() => {
  console.log(`\n  ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}, 50)
