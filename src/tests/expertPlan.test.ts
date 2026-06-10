/**
 * Uzman Kampanya Planı motoru — Unit Tests
 * Çalıştırma: npx tsx src/tests/expertPlan.test.ts
 */
import assert from 'assert'
import {
  goalToObjective,
  clampDailyBudget,
  validateCta,
  deriveMinBudget,
  generateExpertPlan,
} from '../../lib/strategy/expertPlan'
import type { InputPayload } from '../../lib/strategy/types'

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

function input(over: Partial<InputPayload> = {}): InputPayload {
  return {
    goal_type: 'sales',
    product: 'El yapımı deri çanta',
    industry: 'moda',
    geographies: ['İstanbul'],
    language: 'tr',
    monthly_budget_try: 9000,
    currency: 'TRY',
    time_horizon_days: 30,
    channels: { meta: true, google: false, tiktok: false },
    integrations: { pixel: 'green', analytics: 'green', crm: 'yellow' },
    ...over,
  }
}

// AI'nin döndüreceği zengin ham plan
function rawPlan(over: any = {}): any {
  return {
    audience: { summary: 'Kaliteli deri ürün arayan profesyoneller', pains: ['ucuz görünüm'], motivations: ['kalıcılık'], reasoning: 'Marka el yapımı premium konumlanıyor' },
    location: { countries: ['Türkiye'], cities: ['İstanbul', 'Ankara'], reasoning: 'Yüksek alım gücü ve moda ilgisi' },
    demographics: { ageMin: 28, ageMax: 50, genders: 'all', reasoning: 'Premium alıcı yaş bandı' },
    objective: { reasoning: 'Satış odaklı çünkü dönüşüm hedefi var' },
    conversionGoal: { value: 'PURCHASE', label: 'Satın Alma', reasoning: 'E-ticaret satışı' },
    budget: { dailyRecommended: 300, reasoning: 'Aylık bütçeye uygun' },
    cta: { value: 'SHOP_NOW', label: 'Hemen Satın Al', reasoning: 'Doğrudan satış' },
    copy: { variants: [{ headline: 'El Yapımı Deri', primaryText: 'Yıllarca dayanır', description: 'Şimdi keşfet' }], voiceNote: 'premium/sıcak', reasoning: 'Kaliteyi vurgula' },
    ...over,
  }
}

// ── Saf yardımcılar ──
test('goalToObjective: meta sales → OUTCOME_SALES', () => {
  assert.strictEqual(goalToObjective('sales', 'meta').value, 'OUTCOME_SALES')
  assert.strictEqual(goalToObjective('traffic', 'meta').value, 'OUTCOME_TRAFFIC')
})

test('goalToObjective: google traffic → SEARCH', () => {
  assert.strictEqual(goalToObjective('traffic', 'google').value, 'SEARCH')
  assert.strictEqual(goalToObjective('awareness', 'google').value, 'DISPLAY')
})

test('clampDailyBudget: min altı → minimuma yükseltir + warning', () => {
  const r = clampDailyBudget(20, 50)
  assert.strictEqual(r.dailyRecommended, 50)
  assert.ok(r.warning)
})

test('clampDailyBudget: min üstü → değişmez', () => {
  const r = clampDailyBudget(300, 50)
  assert.strictEqual(r.dailyRecommended, 300)
  assert.strictEqual(r.warning, undefined)
})

test('validateCta: geçersiz → fallback + warning', () => {
  const r = validateCta('FOO', ['SHOP_NOW', 'LEARN_MORE'], 'LEARN_MORE')
  assert.strictEqual(r.value, 'LEARN_MORE')
  assert.ok(r.warning)
})

test('validateCta: izin listesi boşsa değere güvenir', () => {
  const r = validateCta('SHOP_NOW', [], 'LEARN_MORE')
  assert.strictEqual(r.value, 'SHOP_NOW')
})

test('deriveMinBudget: onaylı bilgiden minBudget çeker', () => {
  const mb = deriveMinBudget(
    [{ category: 'objective', normalized_key: 'meta.objective.outcome_sales', summary: null, rules_json: { minBudget: 75 }, allowed_values: null }],
    'OUTCOME_SALES',
  )
  assert.strictEqual(mb, 75)
})

// ── generateExpertPlan ──
test('AI hazır değil → boş plan + warning (sahte veri yok)', async () => {
  const plan = await generateExpertPlan(
    { input: input(), platform: 'meta' },
    { claudeReady: () => false, callJson: async () => rawPlan() },
  )
  assert.strictEqual(plan.copy.variants.length, 0)
  assert.ok(plan.warnings.some((w) => w.includes('AI hazır değil')))
  // objective yine deterministik dolu
  assert.strictEqual(plan.objective.value, 'OUTCOME_SALES')
})

test('happy path: alanlar + gerekçe dolu', async () => {
  const plan = await generateExpertPlan(
    { input: input(), platform: 'meta' },
    { claudeReady: () => true, callJson: async () => rawPlan() },
  )
  assert.strictEqual(plan.objective.value, 'OUTCOME_SALES')
  assert.ok(plan.audience.reasoning.length > 0)
  assert.deepStrictEqual(plan.location.cities, ['İstanbul', 'Ankara'])
  assert.strictEqual(plan.copy.variants.length, 1)
  assert.strictEqual(plan.cta.value, 'SHOP_NOW')
})

test('objective AI değil deterministik map\'ten gelir', async () => {
  // AI yanlış objective dönse bile value goal_type'tan
  const plan = await generateExpertPlan(
    { input: input({ goal_type: 'leads' }), platform: 'meta' },
    { claudeReady: () => true, callJson: async () => rawPlan({ objective: { value: 'YANLIS', reasoning: 'x' } }) },
  )
  assert.strictEqual(plan.objective.value, 'OUTCOME_LEADS')
})

test('bütçe min korkuluğu uygulanır (minDailyBudget)', async () => {
  const plan = await generateExpertPlan(
    { input: input(), platform: 'meta', minDailyBudget: 500 },
    { claudeReady: () => true, callJson: async () => rawPlan({ budget: { dailyRecommended: 100, reasoning: 'x' } }) },
  )
  assert.strictEqual(plan.budget.dailyRecommended, 500)
  assert.ok(plan.warnings.some((w) => w.includes('minimum')))
})

test('CTA allowed dışıysa default + warning', async () => {
  const plan = await generateExpertPlan(
    { input: input(), platform: 'meta', ctaAllowed: ['LEARN_MORE'] },
    { claudeReady: () => true, callJson: async () => rawPlan({ cta: { value: 'SHOP_NOW', reasoning: 'x' } }) },
  )
  assert.strictEqual(plan.cta.value, 'LEARN_MORE')
  assert.ok(plan.warnings.some((w) => w.includes('eylem çağrısı')))
})

test('AI cities boş → beyan edilen geographies fallback', async () => {
  const plan = await generateExpertPlan(
    { input: input({ geographies: ['Bursa'] }), platform: 'meta' },
    { claudeReady: () => true, callJson: async () => rawPlan({ location: { countries: ['Türkiye'], cities: [], reasoning: 'x' } }) },
  )
  assert.deepStrictEqual(plan.location.cities, ['Bursa'])
})

;(async () => {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız`)
  if (failed > 0) process.exit(1)
})()
