/**
 * Gözetim Merkezi UI Temizlik — kaynak seviyesi testleri.
 *
 * Hata Takibi kaldırıldı, Son Kayıt Olan Kullanıcılar kaldırıldı,
 * Detay drawer yerine modal, Engelle butonu, sesli uyarı, KPI kontrolleri.
 *
 * Çalıştırma:
 *   npx tsx src/tests/gozetimMerkeziUiCleanup.test.ts
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

function read(relPath: string): string {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf-8')
}

const gozetimClient = 'app/gozetim-merkezi/GozetimMerkeziClient.tsx'
const signupPanel = 'components/gozetim/SignupApprovalsPanel.tsx'

// ─── 1. Hata Takibi kaldırıldı mı? ──────────────────────────────────────────

console.log('\n[1] Hata Takibi kaldırıldı mı?')

test('GozetimMerkeziClient "Hata Takibi" başlığını içermiyor', () => {
  const src = read(gozetimClient)
  assert.ok(!src.includes('Hata Takibi'), '"Hata Takibi" hâlâ mevcut')
})

test('GozetimMerkeziClient recentFailedScans kullanmıyor', () => {
  const src = read(gozetimClient)
  assert.ok(!src.includes('recentFailedScans'), 'recentFailedScans hâlâ mevcut')
})

test('GozetimMerkeziClient errorTypeCounts kullanmıyor', () => {
  const src = read(gozetimClient)
  assert.ok(!src.includes('errorTypeCounts'), 'errorTypeCounts hâlâ mevcut')
})

test('GozetimMerkeziClient "Hata Tipi Dağılımı" içermiyor', () => {
  const src = read(gozetimClient)
  assert.ok(!src.includes('Hata Tipi Dağılımı'), '"Hata Tipi Dağılımı" hâlâ mevcut')
})

// ─── 2. Son Kayıt Olan Kullanıcılar kaldırıldı mı? ───────────────────────────

console.log('\n[2] Son Kayıt Olan Kullanıcılar kaldırıldı mı?')

test('GozetimMerkeziClient "Son Kayıt Olan Kullanıcılar" başlığını içermiyor', () => {
  const src = read(gozetimClient)
  assert.ok(!src.includes('Son Kayıt Olan Kullanıcılar'), '"Son Kayıt Olan Kullanıcılar" hâlâ mevcut')
})

test('GozetimMerkeziClient recentSignups kullanmıyor (standalone tablo olarak)', () => {
  const src = read(gozetimClient)
  // recentSignups tipi kaldırıldı — interface'de artık yok
  assert.ok(!src.includes('RecentSignup'), 'RecentSignup interface hâlâ mevcut')
})

// ─── 3. Detay drawer → modal ─────────────────────────────────────────────────

console.log('\n[3] Detay drawer → modal')

test('SignupApprovalsPanel DrawerDetail değil Modal kullanıyor', () => {
  const src = read(signupPanel)
  assert.ok(!src.includes('SignupDetailDrawer'), 'eski drawer bileşeni hâlâ var')
  assert.ok(src.includes('SignupDetailModal'), 'SignupDetailModal yok')
})

test('SignupApprovalsPanel detay modal data-testid içeriyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('signup-detail-modal'), 'data-testid yok')
})

test('GozetimMerkeziClient DetailDrawer yerine DetailModal kullanıyor', () => {
  const src = read(gozetimClient)
  assert.ok(!src.includes('DetailDrawer'), 'eski DrawerDetail hâlâ var')
  assert.ok(src.includes('DetailModal'), 'DetailModal yok')
})

test('modal ortalanmış layout kullanıyor (items-center justify-center)', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('items-center') && src.includes('justify-center'), 'ortalanmış layout yok')
})

// ─── 4. Engelle butonu ───────────────────────────────────────────────────────

console.log('\n[4] Engelle butonu ve BlockModal')

test('SignupApprovalsPanel Engelle butonu içeriyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('Engelle'), '"Engelle" butonu yok')
})

test('SignupApprovalsPanel BlockModal içeriyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('BlockModal'), 'BlockModal bileşeni yok')
})

test('BlockModal 6 seçenek içeriyor (user/email/domain/ip/all/manual_review)', () => {
  const src = read(signupPanel)
  assert.ok(src.includes("'user'"), 'user seçeneği yok')
  assert.ok(src.includes("'email'"), 'email seçeneği yok')
  assert.ok(src.includes("'domain'"), 'domain seçeneği yok')
  assert.ok(src.includes("'ip'"), 'ip seçeneği yok')
  assert.ok(src.includes("'all'"), 'all seçeneği yok')
  assert.ok(src.includes("'manual_review'"), 'manual_review seçeneği yok')
})

test('BlockModal block-option data-testid\'leri içeriyor', () => {
  const src = read(signupPanel)
  // Template literal ile üretilen testid: `block-option-${opt.value}`
  assert.ok(src.includes('block-option-'), 'block-option- template testid yok')
  assert.ok(src.includes('opt.value'), 'opt.value template yok')
})

test('BlockModal confirm butonu data-testid içeriyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('block-confirm-btn'), 'block-confirm-btn testid yok')
})

// ─── 5. Sesli uyarı ──────────────────────────────────────────────────────────

console.log('\n[5] Sesli uyarı')

test('SignupApprovalsPanel sound-toggle data-testid içeriyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('sound-toggle'), 'sound-toggle testid yok')
})

test('SignupApprovalsPanel playBeep fonksiyonu içeriyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('playBeep'), 'playBeep fonksiyonu yok')
})

test('SignupApprovalsPanel localStorage ile ses tercihini hatırlıyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('localStorage'), 'localStorage kullanılmıyor')
  assert.ok(src.includes('gozetim_sound_enabled'), 'sound_enabled key yok')
})

test('SignupApprovalsPanel sound-toast data-testid içeriyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('sound-toast'), 'sound-toast testid yok')
})

// ─── 6. KPI kartları ─────────────────────────────────────────────────────────

console.log('\n[6] KPI kartları')

test('SignupApprovalsPanel KPI chip\'leri içeriyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('KpiChip'), 'KpiChip bileşeni yok')
})

test('KPI bekleyen sayısını gösteriyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('kpis.pending'), 'pending KPI yok')
})

test('KPI engellenen sayısını gösteriyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('kpis.blocked'), 'blocked KPI yok')
})

test('KPI manuel inceleme sayısını gösteriyor', () => {
  const src = read(signupPanel)
  assert.ok(src.includes('kpis.manualReview'), 'manualReview KPI yok')
})

// ─── 7. Renk kuralı kontrol ───────────────────────────────────────────────────

console.log('\n[7] Renk kuralı (amber/yellow yasak)')

test('SignupApprovalsPanel amber renk kullanmıyor', () => {
  const src = read(signupPanel)
  assert.ok(!/bg-amber-|text-amber-|border-amber-/.test(src), 'amber sınıfı kullanılıyor')
  assert.ok(!/bg-yellow-|text-yellow-|border-yellow-/.test(src), 'yellow sınıfı kullanılıyor')
})

test('GozetimMerkeziClient amber renk kullanmıyor', () => {
  const src = read(gozetimClient)
  assert.ok(!/bg-amber-|text-amber-|border-amber-/.test(src), 'amber sınıfı kullanılıyor')
  assert.ok(!/bg-yellow-|text-yellow-|border-yellow-/.test(src), 'yellow sınıfı kullanılıyor')
})

// ─── 8. Filtreler ─────────────────────────────────────────────────────────────

console.log('\n[8] Filtreler')

test('SignupApprovalsPanel manual_review filtresi var', () => {
  const src = read(signupPanel)
  assert.ok(src.includes("value=\"manual_review\"") || src.includes("'manual_review'"), 'manual_review filtresi yok')
})

test('SignupApprovalsPanel blocked filtresi var', () => {
  const src = read(signupPanel)
  assert.ok(src.includes("value=\"blocked\"") || src.includes("'blocked'"), 'blocked filtresi yok')
})

// ─── 9. GozetimMerkeziClient SignupApprovalsPanel render ediyor ───────────────

console.log('\n[9] SignupApprovalsPanel entegrasyonu')

test('GozetimMerkeziClient SignupApprovalsPanel render ediyor', () => {
  const src = read(gozetimClient)
  assert.ok(src.includes('SignupApprovalsPanel'), 'panel render edilmiyor')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
