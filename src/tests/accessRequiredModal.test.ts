/**
 * Access Required Modal — Source-level Unit Tests
 *
 * Yeni global standart: kredi gerektiren ve abonelik gerektiren tüm
 * YoAi alanlarında `AccessRequiredModal` kullanılır. Bu test paketi
 * statik metin denetimleriyle aşağıdaki garantileri korur:
 *   - Modal kapatılamaz (X yok, ESC yutulur, dış tıklama yutulur)
 *   - İki tür ('credit' / 'subscription') ayırt edilebilir
 *   - Inline kredi/abonelik hata mesajları gating'li alanlarda kalmadı
 *   - Owner allowlist hem API hem UI tarafında bypass uygular
 *   - CLAUDE.md kuralı yeni standardı yansıtır
 *
 * Çalıştırma:
 *   npx tsx src/tests/accessRequiredModal.test.ts
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
const accessModalFile = path.join(repoRoot, 'components', 'billing', 'AccessRequiredModal.tsx')
const creditWrapperFile = path.join(repoRoot, 'components', 'billing', 'CreditRequiredModal.tsx')
const featureMapFile = path.join(repoRoot, 'lib', 'billing', 'featureAccessMap.ts')
const ownerClientFile = path.join(repoRoot, 'lib', 'admin', 'superAdminClient.ts')
const ownerServerFile = path.join(repoRoot, 'lib', 'admin', 'superAdmin.ts')
const optimizasyonPage = path.join(repoRoot, 'app', 'optimizasyon', 'page.tsx')
const stratejiPage = path.join(repoRoot, 'app', 'strateji', 'page.tsx')
const yoaiPage = path.join(repoRoot, 'app', 'yoai', 'page.tsx')
const tasarimPage = path.join(repoRoot, 'app', 'tasarim', 'page.tsx')
const seoPage = path.join(repoRoot, 'app', 'seo', 'page.tsx')
const hedefKitlePage = path.join(repoRoot, 'app', 'hedef-kitle', 'page.tsx')
const billingApi = path.join(repoRoot, 'app', 'api', 'billing', 'current', 'route.ts')
const creditProvider = path.join(repoRoot, 'components', 'providers', 'CreditProvider.tsx')
const subscriptionProvider = path.join(repoRoot, 'components', 'providers', 'SubscriptionProvider.tsx')
const serverGuard = path.join(repoRoot, 'lib', 'meta', 'optimization', 'serverGuard.ts')
const businessProfileGuardFile = path.join(repoRoot, 'components', 'yoai', 'BusinessProfileGuard.tsx')
const claudeMd = path.join(repoRoot, 'CLAUDE.md')

const accessSrc = fs.readFileSync(accessModalFile, 'utf-8')
const creditWrapperSrc = fs.readFileSync(creditWrapperFile, 'utf-8')
const featureMapSrc = fs.readFileSync(featureMapFile, 'utf-8')
const ownerClientSrc = fs.readFileSync(ownerClientFile, 'utf-8')
const ownerServerSrc = fs.readFileSync(ownerServerFile, 'utf-8')
const optimizasyonSrc = fs.readFileSync(optimizasyonPage, 'utf-8')
const stratejiSrc = fs.readFileSync(stratejiPage, 'utf-8')
const yoaiSrc = fs.readFileSync(yoaiPage, 'utf-8')
const tasarimSrc = fs.readFileSync(tasarimPage, 'utf-8')
const seoSrc = fs.readFileSync(seoPage, 'utf-8')
const hedefKitleSrc = fs.readFileSync(hedefKitlePage, 'utf-8')
const billingSrc = fs.readFileSync(billingApi, 'utf-8')
const creditProviderSrc = fs.readFileSync(creditProvider, 'utf-8')
const subscriptionProviderSrc = fs.readFileSync(subscriptionProvider, 'utf-8')
const guardSrc = fs.readFileSync(serverGuard, 'utf-8')
const businessProfileGuardSrc = fs.readFileSync(businessProfileGuardFile, 'utf-8')
const claudeSrc = fs.readFileSync(claudeMd, 'utf-8')

// ── 1. AccessRequiredModal contract ────────────────────────────────
console.log('\n[1] AccessRequiredModal davranışı')

test('component dosyası mevcut', () => {
  assert.ok(fs.existsSync(accessModalFile), 'AccessRequiredModal.tsx eksik')
})

test("type prop 'credit' | 'subscription' olarak tanımlı", () => {
  assert.ok(
    /AccessRequiredType\s*=\s*'credit'\s*\|\s*'subscription'/.test(accessSrc),
    "AccessRequiredType union 'credit' | 'subscription' içermiyor",
  )
})

test('kapatma X butonu yok', () => {
  assert.ok(
    !/<X[\s/]/.test(accessSrc) && !/aria-label="Close"/i.test(accessSrc),
    'Modal kapatma butonu içermemeli (X yok)',
  )
})

test('ESC tuşu yutuluyor', () => {
  assert.ok(
    /key === 'Escape'/.test(accessSrc) && /preventDefault\(\)/.test(accessSrc),
    'ESC kapanmasını engelleyen handler bulunmuyor',
  )
})

test('dış tıklama kapatmıyor (backdrop preventDefault)', () => {
  assert.ok(
    /onClick=\{\s*\(e\)\s*=>\s*\{[\s\S]*?preventDefault\(\)[\s\S]*?stopPropagation/.test(
      accessSrc,
    ),
    'Backdrop onClick yutmuyor (preventDefault+stopPropagation eksik)',
  )
})

test('blur backdrop mevcut', () => {
  assert.ok(
    /backdrop-blur-md/.test(accessSrc) && /bg-black\/50/.test(accessSrc),
    'Blur arkalık (backdrop-blur-md + bg-black/50) yok',
  )
})

test('body scroll lock var', () => {
  assert.ok(
    /document\.body\.style\.overflow\s*=\s*'hidden'/.test(accessSrc),
    'Body scroll lock yok',
  )
})

test('amber/yellow renk kuralı ihlali yok', () => {
  assert.ok(
    !/bg-amber-|text-amber-|border-amber-|bg-yellow-|text-yellow-|border-yellow-/.test(
      accessSrc,
    ),
    'Modal amber/yellow ton içeriyor — CLAUDE.md renk kuralı ihlali',
  )
})

test('CTA buton mevcut ve ROUTES.SUBSCRIPTION temelli', () => {
  assert.ok(
    /ROUTES\.SUBSCRIPTION/.test(accessSrc),
    'CTA hedefi ROUTES.SUBSCRIPTION değil',
  )
})

// ── 2. Subscription vs Credit ayrımı ───────────────────────────────
console.log('\n[2] Subscription vs Credit modal ayrımı')

test('subscription default başlığı tanımlı', () => {
  assert.ok(
    /Bu özellik için abonelik gereklidir/.test(accessSrc),
    "Subscription modal başlığı 'abonelik gereklidir' içermiyor",
  )
})

test('credit default başlığı tanımlı', () => {
  assert.ok(
    /Bu işlem için kredi gereklidir/.test(accessSrc),
    "Credit modal başlığı 'kredi gereklidir' içermiyor",
  )
})

test("subscription badge default 'ABONELİK'", () => {
  assert.ok(/badge:\s*'ABONELİK'/.test(accessSrc), "Subscription badge 'ABONELİK' değil")
})

test("credit badge default 'AI KREDİ'", () => {
  assert.ok(/badge:\s*'AI KREDİ'/.test(accessSrc), "Credit badge 'AI KREDİ' değil")
})

test("subscription CTA 'Planları İncele'", () => {
  assert.ok(/cta:\s*'Planları İncele'/.test(accessSrc), "Subscription CTA 'Planları İncele' değil")
})

test("credit CTA 'Kredi Yükle'", () => {
  assert.ok(/cta:\s*'Kredi Yükle'/.test(accessSrc), "Credit CTA 'Kredi Yükle' değil")
})

test('credit ikonları (Sparkles + Zap) import edildi', () => {
  assert.ok(/Sparkles/.test(accessSrc) && /Zap/.test(accessSrc), 'Sparkles/Zap import yok')
})

test('subscription ikonları (ShieldCheck + Lock) import edildi', () => {
  assert.ok(
    /ShieldCheck/.test(accessSrc) && /Lock/.test(accessSrc),
    'ShieldCheck/Lock import yok',
  )
})

test('credit CTA href #krediler fragment kullanır', () => {
  assert.ok(
    /\$\{ROUTES\.SUBSCRIPTION\}#krediler/.test(accessSrc) ||
      /ROUTES\.SUBSCRIPTION.*#krediler/.test(accessSrc),
    'Credit CTA #krediler derin link kullanmıyor',
  )
})

// ── 3. CreditRequiredModal back-compat wrapper ─────────────────────
console.log('\n[3] CreditRequiredModal back-compat')

test('CreditRequiredModal AccessRequiredModal\'a delege ediyor', () => {
  assert.ok(
    /import\s+AccessRequiredModal/.test(creditWrapperSrc) &&
      /type="credit"/.test(creditWrapperSrc),
    'CreditRequiredModal artık AccessRequiredModal type="credit" wrapper olmalı',
  )
})

// ── 4. featureAccessMap kaydı ──────────────────────────────────────
console.log('\n[4] Feature access map')

test('featureAccessMap dosyası mevcut', () => {
  assert.ok(fs.existsSync(featureMapFile), 'lib/billing/featureAccessMap.ts eksik')
})

test('subscription_required tier tanımlı', () => {
  assert.ok(
    /subscription_required/.test(featureMapSrc),
    'subscription_required tier eksik',
  )
})

test('credit_required tier tanımlı', () => {
  assert.ok(/credit_required/.test(featureMapSrc), 'credit_required tier eksik')
})

const requiredFeatureKeys = [
  'optimization',
  'strategy',
  'yoalgoritma',
  'seo',
  'audience_ai',
  'optimization_ai_scan_pro',
  'design_generation',
  'strategy_overage',
  'yoalgoritma_chat',
]
for (const key of requiredFeatureKeys) {
  test(`feature key '${key}' kayıtlı`, () => {
    const re = new RegExp(`${key}:\\s*\\{`)
    assert.ok(re.test(featureMapSrc), `${key} kaydı featureAccessMap'te yok`)
  })
}

// ── 5. Owner bypass ────────────────────────────────────────────────
console.log('\n[5] Owner allowlist bypass')

test('client-safe owner helper mevcut', () => {
  assert.ok(fs.existsSync(ownerClientFile), 'lib/admin/superAdminClient.ts eksik')
})

test('client owner allowlist onursuay@hotmail.com içerir', () => {
  assert.ok(
    /onursuay@hotmail\.com/.test(ownerClientSrc),
    'PUBLIC_OWNER_EMAILS default email içermiyor',
  )
})

test('server superAdmin allowlist hâlâ mevcut', () => {
  assert.ok(
    /isSuperAdminEmail/.test(ownerServerSrc) &&
      /onursuay@hotmail\.com/.test(ownerServerSrc),
    'Server allowlist bozulmuş',
  )
})

test('/api/billing/current owner için isOwner:true döndürüyor', () => {
  assert.ok(
    /isSuperAdminEmail\(user\.email\)/.test(billingSrc) &&
      /isOwner:\s*true/.test(billingSrc),
    'Billing API owner dalı isOwner:true bayrağını döndürmüyor',
  )
})

test('/api/billing/current normal kullanıcı için isOwner:false döner', () => {
  assert.ok(/isOwner:\s*false/.test(billingSrc), 'Billing API normal dalı isOwner:false eksik')
})

test('CreditProvider isOwner bayrağını expose ediyor', () => {
  assert.ok(
    /isOwner:\s*Boolean\(data\.isOwner\)/.test(creditProviderSrc) &&
      /isOwner:\s*state\.isOwner/.test(creditProviderSrc),
    'CreditProvider isOwner bayrağı eksik',
  )
})

test('CreditProvider hasEnoughCredits owner için true döndürüyor', () => {
  assert.ok(
    /if\s*\(state\.isOwner\)\s*return\s*true/.test(creditProviderSrc),
    'hasEnoughCredits owner bypass dalı eksik',
  )
})

test('SubscriptionProvider isOwner bayrağını expose ediyor', () => {
  assert.ok(
    /setIsOwner\(Boolean\(data\?\.isOwner\)\)/.test(subscriptionProviderSrc) &&
      /isOwner,/.test(subscriptionProviderSrc),
    'SubscriptionProvider isOwner bayrağı eksik',
  )
})

// ── 6. Backend guard güvenliği korunuyor ───────────────────────────
console.log('\n[6] Backend guard güvenliği')

test('requireOptimizationAccess hâlâ unauthenticated 401 üretiyor', () => {
  assert.ok(
    /deny\(401,\s*'unauthenticated'/.test(guardSrc),
    'serverGuard 401 unauthenticated dalı bozulmuş',
  )
})

test('requireOptimizationAccess hâlâ 403 no_subscription üretiyor', () => {
  assert.ok(
    /deny\(403,\s*'no_subscription'/.test(guardSrc),
    'serverGuard 403 no_subscription dalı bozulmuş',
  )
})

test('owner allowlist bypass dalı backend guard\'da var', () => {
  assert.ok(
    /isSuperAdminEmail\(user\.email\)/.test(guardSrc) &&
      /planId:\s*'enterprise'/.test(guardSrc),
    'serverGuard owner bypass dalı eksik/değişmiş',
  )
})

// ── 7. Page entegrasyonları ────────────────────────────────────────
console.log('\n[7] Sayfa entegrasyonları')

test('Optimizasyon sayfası AccessRequiredModal import ediyor', () => {
  assert.ok(
    /from\s+'@\/components\/billing\/AccessRequiredModal'/.test(optimizasyonSrc),
    'Optimizasyon AccessRequiredModal import etmiyor',
  )
})

test('Optimizasyon eski SubscriptionGateModal import etmiyor', () => {
  assert.ok(
    !/from\s+'@\/components\/subscription\/SubscriptionGateModal'/.test(optimizasyonSrc),
    'Optimizasyon hâlâ SubscriptionGateModal import ediyor',
  )
})

test('Optimizasyon 403 dalında accessDenied set ediliyor', () => {
  assert.ok(
    /response\.status\s*===\s*403/.test(optimizasyonSrc) &&
      /setAccessDenied\(true\)/.test(optimizasyonSrc),
    '403 dalı setAccessDenied(true) çağırmıyor',
  )
})

test('Optimizasyon accessDenied modal type="subscription"', () => {
  assert.ok(
    /accessDenied\s*&&[\s\S]*?AccessRequiredModal[\s\S]*?type="subscription"/.test(
      optimizasyonSrc,
    ),
    'accessDenied subscription modalı render etmiyor',
  )
})

test('Optimizasyon AI scan limit kredi modalına bağlı', () => {
  assert.ok(
    /optimization_ai_scan_pro/.test(optimizasyonSrc),
    'AI scan limit kredi modalı featureKey=optimization_ai_scan_pro değil',
  )
})

test('Strateji sayfası AccessRequiredModal kullanıyor', () => {
  assert.ok(
    /from\s+'@\/components\/billing\/AccessRequiredModal'/.test(stratejiSrc) &&
      /AccessRequiredModal/.test(stratejiSrc),
    'Strateji AccessRequiredModal kullanmıyor',
  )
})

test('Strateji subscription guard hasSubscription kontrol ediyor', () => {
  assert.ok(
    /!hasSubscription/.test(stratejiSrc) &&
      /setGateFeatureKey\('strategy'\)/.test(stratejiSrc) &&
      /strategy_overage/.test(stratejiSrc),
    "Strateji subscription guard ya da overage credit guard eksik",
  )
})

test('YoAlgoritma sayfası AccessRequiredModal kullanıyor', () => {
  assert.ok(
    /AccessRequiredModal/.test(yoaiSrc) &&
      /yoalgoritma/.test(yoaiSrc) &&
      /yoalgoritma_chat/.test(yoaiSrc),
    'YoAlgoritma access modal entegrasyonu eksik',
  )
})

test('YoAlgoritma inline "Yeterli krediniz bulunmuyor" mesajı kaldırıldı', () => {
  assert.ok(
    !/Yeterli krediniz bulunmuyor/.test(yoaiSrc),
    'Inline credit error mesajı hâlâ YoAlgoritma sayfasında',
  )
})

test('Tasarım sayfası AccessRequiredModal kullanıyor (kredi)', () => {
  assert.ok(
    /AccessRequiredModal/.test(tasarimSrc) && /design_generation/.test(tasarimSrc),
    'Tasarım kredi modal entegrasyonu eksik',
  )
})

test('Tasarım handleGenerate yetersiz kredide modal açıyor', () => {
  assert.ok(
    /!hasEnoughCredits\(\)\)\s*\{\s*setShowCreditGate\(true\)/.test(tasarimSrc),
    'Tasarım handleGenerate yetersiz kredide modal açmıyor',
  )
})

test('SEO sayfası subscription gate ekledi', () => {
  assert.ok(
    /AccessRequiredModal/.test(seoSrc) &&
      /featureKey="seo"/.test(seoSrc) &&
      /!hasSubscription/.test(seoSrc),
    'SEO subscription guard eksik',
  )
})

test('Hedef Kitle AI sekmesi subscription gate', () => {
  assert.ok(
    /AccessRequiredModal/.test(hedefKitleSrc) &&
      /audience_ai/.test(hedefKitleSrc) &&
      /tabId === 'AI'/.test(hedefKitleSrc),
    'Hedef Kitle AI tab subscription guard eksik',
  )
})

// ── 8. Inline error temizliği (gating'li alanlarda) ────────────────
console.log('\n[8] Inline ödeme/abonelik hata temizliği')

test('Optimizasyon sayfası inline "abonelik gerek" yazısı içermiyor', () => {
  assert.ok(
    !/abonelik gerek/i.test(optimizasyonSrc),
    'Optimizasyon hâlâ inline abonelik hata yazısı içeriyor',
  )
})

test('Strateji sayfası inline "kredi gerek" mesajı modal\'a taşındı', () => {
  // Strateji'de kredi mesajı toast olarak ("kredi kullanıldı") kalır;
  // erişim hatası inline değil, modal üzerinden gösterilir.
  assert.ok(
    !/Strateji Limiti Doldu/.test(stratejiSrc),
    'Strateji sayfası eski SubscriptionGateModal metnini hâlâ içeriyor',
  )
})

test('YoAlgoritma sayfası inline kredi hatası içermiyor', () => {
  assert.ok(
    !/Yeterli krediniz bulunmuyor/.test(yoaiSrc),
    'YoAlgoritma hâlâ inline kredi hatası içeriyor',
  )
})

// ── 9. BusinessProfileGuard önceliği ───────────────────────────────
console.log('\n[9] BusinessProfileGuard önceliği')

test('BusinessProfileGuard component dosyası mevcut', () => {
  assert.ok(
    fs.existsSync(businessProfileGuardFile),
    'BusinessProfileGuard component eksik',
  )
})

test('BusinessProfileGuard mevcut layout sıralamasında — strateji', () => {
  const layout = fs.readFileSync(
    path.join(repoRoot, 'app', 'strateji', 'layout.tsx'),
    'utf-8',
  )
  assert.ok(
    /BusinessProfileGuard/.test(layout),
    'Strateji layout BusinessProfileGuard kullanmıyor',
  )
})

// ── 10. CLAUDE.md kuralı ───────────────────────────────────────────
console.log('\n[10] CLAUDE.md proje kuralı')

test('CLAUDE.md AccessRequiredModal kuralını içeriyor', () => {
  assert.ok(
    /AccessRequiredModal\.tsx/.test(claudeSrc),
    'CLAUDE.md AccessRequiredModal referansı eksik',
  )
})

test('CLAUDE.md credit / subscription tier ayrımı dokümante', () => {
  assert.ok(
    /Abonelik zorunlu alanlar/.test(claudeSrc) &&
      /Kredi zorunlu alanlar/.test(claudeSrc),
    'CLAUDE.md tier kategorileri eksik',
  )
})

test('CLAUDE.md owner bypass kuralını içeriyor', () => {
  assert.ok(
    /onursuay@hotmail\.com/.test(claudeSrc) && /isOwner/.test(claudeSrc),
    'CLAUDE.md owner bypass kuralı eksik',
  )
})

test('CLAUDE.md inline hata yasağı vurgulu', () => {
  assert.ok(
    /düz inline hata mesajı/i.test(claudeSrc),
    "CLAUDE.md 'düz inline hata mesajı' yasağı eksik",
  )
})

// ── Sonuç ──────────────────────────────────────────────────────────
setTimeout(() => {
  console.log(`\n  ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}, 50)
