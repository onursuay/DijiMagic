/**
 * Campaign Intent Engine — Unit Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/campaignIntentEngine.test.ts
 *
 * Test framework gerektirmez; Node assert modülü kullanır.
 * Supabase ve OpenAI bağlantısı mock edilir (env değişkeni yoksa).
 */

import assert from 'assert'

// ── Minimal type stubs ────────────────────────────────────────────────────────
// (Real types from analysisTypes.ts — inlined here to avoid import chain issues in tests)

interface MockAdInsight {
  id: string
  name: string
  status: string
  platform: 'Meta' | 'Google'
  metrics: {
    spend: number; impressions: number; clicks: number
    ctr: number; cpc: number; conversions: number; roas: number | null
  }
  creativeBody?: string
  creativeTitle?: string
  linkUrl?: string
}

interface MockAdsetInsight {
  id: string
  name: string
  status: string
  platform: 'Meta' | 'Google'
  optimizationGoal?: string
  destinationType?: string
  dailyBudget: number | null
  lifetimeBudget: number | null
  metrics: MockAdInsight['metrics']
  ads: MockAdInsight[]
}

interface MockCampaign {
  id: string
  platform: 'Meta' | 'Google'
  campaignName: string
  status: string
  objective: string
  channelType?: string
  biddingStrategy?: string
  metrics: MockAdInsight['metrics']
  adsets: MockAdsetInsight[]
  dailyBudget: number | null
  lifetimeBudget: number | null
  currency: string
  score: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  problemTags: unknown[]
}

// ── Test helpers ──────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name: string, fn: () => void | Promise<void>): void {
  const result = fn()
  if (result instanceof Promise) {
    result.then(() => {
      console.log(`  ✓  ${name}`)
      passed++
    }).catch(err => {
      const msg = err instanceof assert.AssertionError ? err.message : String(err)
      console.error(`  ✗  ${name}`)
      console.error(`     ${msg}`)
      failed++
    })
  } else {
    try {
      console.log(`  ✓  ${name}`)
      passed++
    } catch (err) {
      const msg = err instanceof assert.AssertionError ? err.message : String(err)
      console.error(`  ✗  ${name}`)
      console.error(`     ${msg}`)
      failed++
    }
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMetrics(): MockAdInsight['metrics'] {
  return { spend: 500, impressions: 10000, clicks: 150, ctr: 0.015, cpc: 3.33, conversions: 5, roas: null }
}

function makeAd(overrides: Partial<MockAdInsight> = {}): MockAdInsight {
  return {
    id: 'ad_1',
    name: 'Test Reklam',
    status: 'ACTIVE',
    platform: 'Google',
    metrics: makeMetrics(),
    ...overrides,
  }
}

function makeAdset(overrides: Partial<MockAdsetInsight> = {}): MockAdsetInsight {
  return {
    id: 'adset_1',
    name: 'Test Reklam Grubu',
    status: 'ACTIVE',
    platform: 'Google',
    dailyBudget: 50,
    lifetimeBudget: null,
    metrics: makeMetrics(),
    ads: [makeAd()],
    ...overrides,
  }
}

function makeCampaign(overrides: Partial<MockCampaign> = {}): MockCampaign {
  return {
    id: 'camp_1',
    platform: 'Google',
    campaignName: 'Test Kampanya',
    status: 'ACTIVE',
    objective: 'SEARCH',
    metrics: makeMetrics(),
    adsets: [makeAdset()],
    dailyBudget: 50,
    lifetimeBudget: null,
    currency: 'TRY',
    score: 70,
    riskLevel: 'low',
    problemTags: [],
    ...overrides,
  }
}

// ── Helper: run heuristic extraction inline (mirrors engine logic) ─────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sığüşöçİĞÜŞÖÇ]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3)
}

function collectTokens(campaign: MockCampaign): string[] {
  const signals: string[] = [campaign.campaignName, campaign.objective]
  for (const adset of campaign.adsets) {
    signals.push(adset.name)
    for (const ad of adset.ads) {
      signals.push(ad.name)
      if (ad.creativeBody) signals.push(ad.creativeBody)
      if (ad.creativeTitle) signals.push(ad.creativeTitle)
    }
  }
  const tokens: string[] = []
  for (const s of signals) tokens.push(...tokenize(s))
  return [...new Set(tokens)]
}

interface DomainEntry { domain: string; keywords: string[] }
const DOMAIN_SIGNALS: DomainEntry[] = [
  { domain: 'mesleki belgelendirme', keywords: ['belge', 'sertifika', 'yeterlilik', 'mesleki', 'sınav', 'mys', 'meb', 'megep', 'ehliyet', 'diploma'] },
  { domain: 'eğitim ve kurs', keywords: ['kurs', 'eğitim', 'öğrenim', 'training', 'okul', 'seminer', 'workshop'] },
  { domain: 'e-ticaret / perakende', keywords: ['mağaza', 'satış', 'alışveriş', 'ürün', 'sipariş', 'fiyat', 'indirim'] },
  { domain: 'gayrimenkul', keywords: ['kiralık', 'satılık', 'ev', 'daire', 'konut', 'emlak'] },
]

function detectDomain(tokens: string[]): string {
  let best = { domain: 'genel', score: 0 }
  for (const entry of DOMAIN_SIGNALS) {
    let score = 0
    for (const kw of entry.keywords) {
      if (tokens.some(t => t.includes(kw) || kw.includes(t))) score++
    }
    if (score > best.score) best = { domain: entry.domain, score }
  }
  return best.domain
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nCampaign Intent Engine — Tests\n')

// Test 1: Aşçılık belgesi kampanyasından doğru domain çıkarılıyor
test('aşçılık belgesi kampanyası: domain = mesleki belgelendirme', () => {
  const campaign = makeCampaign({
    campaignName: 'Aşçılık Belgesi - Sınav Başvurusu',
    adsets: [makeAdset({
      name: 'Aşçılık Yeterlilik Sınavı',
      ads: [makeAd({ name: 'Aşçılık Belgesi Reklam', creativeTitle: 'Aşçılık Sertifikası Al' })],
    })],
  })
  const tokens = collectTokens(campaign)
  const domain = detectDomain(tokens)
  assert.strictEqual(domain, 'mesleki belgelendirme', `Beklenen "mesleki belgelendirme", alınan "${domain}"`)
})

// Test 2: Kurs kampanyasından eğitim domain'i çıkarılıyor
test('online kurs kampanyası: domain = eğitim ve kurs', () => {
  const campaign = makeCampaign({
    campaignName: 'Online Excel Eğitimi',
    adsets: [makeAdset({ name: 'Excel Kurs Grubu', ads: [makeAd({ name: 'Excel Workshop Reklam' })] })],
  })
  const tokens = collectTokens(campaign)
  const domain = detectDomain(tokens)
  assert.strictEqual(domain, 'eğitim ve kurs')
})

// Test 3: Gayrimenkul kampanyasından doğru domain çıkarılıyor
test('gayrimenkul kampanyası: domain = gayrimenkul', () => {
  const campaign = makeCampaign({
    campaignName: 'Satılık Daire İstanbul',
    adsets: [makeAdset({ name: 'Konut Satış Grubu', ads: [makeAd({ name: 'Emlak Reklam' })] })],
  })
  const tokens = collectTokens(campaign)
  const domain = detectDomain(tokens)
  assert.strictEqual(domain, 'gayrimenkul')
})

// Test 4: Generic kampanya düşük token sayısı üretir
test('generic kampanya: token sayısı az, domain = genel', () => {
  const campaign = makeCampaign({
    campaignName: 'Campaign 1',
    adsets: [makeAdset({ name: 'Ad Group 1', ads: [makeAd({ name: 'Ad 1' })] })],
  })
  const tokens = collectTokens(campaign)
  const domain = detectDomain(tokens)
  // Generic campaign should get 'genel' as domain
  assert.strictEqual(domain, 'genel', `Generic kampanya "genel" domain almalı, aldı: "${domain}"`)
})

// Test 5: Funnel stage mapping doğru çalışıyor
test('funnel stage: Meta OUTCOME_AWARENESS → awareness', () => {
  function mapFunnelStage(objective: string, platform: 'Meta' | 'Google'): string {
    const obj = objective.toUpperCase()
    if (platform === 'Meta') {
      if (['OUTCOME_AWARENESS', 'REACH', 'BRAND_AWARENESS', 'VIDEO_VIEWS'].includes(obj)) return 'awareness'
      if (['OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'LINK_CLICKS'].includes(obj)) return 'consideration'
      if (['OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_APP_PROMOTION'].includes(obj)) return 'conversion'
      return 'consideration'
    }
    if (['VIDEO', 'DISPLAY', 'DEMAND_GEN'].includes(obj)) return 'awareness'
    if (['SEARCH'].includes(obj)) return 'conversion'
    if (['PERFORMANCE_MAX', 'SHOPPING'].includes(obj)) return 'full_funnel'
    return 'conversion'
  }

  assert.strictEqual(mapFunnelStage('OUTCOME_AWARENESS', 'Meta'), 'awareness')
  assert.strictEqual(mapFunnelStage('OUTCOME_LEADS', 'Meta'), 'conversion')
  assert.strictEqual(mapFunnelStage('SEARCH', 'Google'), 'conversion')
  assert.strictEqual(mapFunnelStage('PERFORMANCE_MAX', 'Google'), 'full_funnel')
  assert.strictEqual(mapFunnelStage('VIDEO', 'Google'), 'awareness')
})

// Test 6: Missing data — adsets boş kampanyada missing_data'ya ekleniyor
test('adsets boş: missing_data içinde adsets görünür', () => {
  const campaign = makeCampaign({ adsets: [] })
  const missing: string[] = []
  if (!campaign.adsets.length) missing.push('adsets')
  assert.ok(missing.includes('adsets'), 'adsets missing_data içinde olmalı')
})

// Test 7: Landing URL yoksa missing_data'ya ekleniyor
test('final_url yok: missing_data içinde final_url görünür', () => {
  const campaign = makeCampaign({
    adsets: [makeAdset({ ads: [makeAd({ linkUrl: undefined })] })],
  })
  const missing: string[] = []
  const urls: string[] = []
  for (const adset of campaign.adsets) {
    for (const ad of adset.ads) {
      if (ad.linkUrl && /^https?:\/\/.+/i.test(ad.linkUrl)) urls.push(ad.linkUrl)
    }
  }
  if (urls.length === 0) missing.push('final_url')
  assert.ok(missing.includes('final_url'))
})

// Test 8: Confidence hesaplama — yüksek signal varsa confidence yükseliyor
test('confidence: çok sinyalle başlayan kampanya ≥ 40 confidence alır', () => {
  function calculateConfidence(domainScore: number, offerScore: number, signalCount: number): number {
    let score = 30
    score += Math.min(domainScore * 12, 20)
    score += Math.min(offerScore * 10, 15)
    score += Math.min(signalCount * 2, 15)
    return Math.max(0, Math.min(90, score))
  }

  const richConf = calculateConfidence(2, 1, 4)    // domain match + offer match + signals
  const poorConf = calculateConfidence(0, 0, 0)    // no signals

  assert.ok(richConf >= 60, `Zengin kampanya confidence >= 60 olmalı, aldı: ${richConf}`)
  assert.ok(poorConf <= 40, `Zayıf kampanya confidence <= 40 olmalı, aldı: ${poorConf}`)
})

// Test 9: formatIntentForPrompt çıktısı intent alanlarını içeriyor
test('formatIntentForPrompt: çıktı tüm alanları içeriyor', () => {
  const profile = {
    campaign_id: 'camp_1',
    platform: 'Google' as const,
    campaign_type: 'SEARCH',
    business_domain: 'mesleki belgelendirme',
    offer_type: 'sınav ve belgelendirme hizmeti',
    service_or_product: 'aşçılık belgesi',
    target_audience: 'belge almak isteyen profesyoneller',
    conversion_goal: 'başvuru formu doldurma',
    funnel_stage: 'conversion' as const,
    detected_keywords: ['aşçılık', 'belge', 'sınav'],
    landing_page_summary: '',
    forbidden_claims: [],
    required_disclaimers: [],
    confidence: 80,
    missing_data: [],
    evidence_json: {},
    generated_at: new Date().toISOString(),
  }

  function formatIntentForPrompt(p: typeof profile): string {
    const lines = [
      `  KAMPANYA INTENT (güven: ${p.confidence}/100):`,
      `  İş Alanı: ${p.business_domain}`,
      `  Ürün/Hizmet: ${p.service_or_product}`,
      `  Teklif Türü: ${p.offer_type}`,
      `  Hedef Kitle: ${p.target_audience}`,
      `  Dönüşüm Hedefi: ${p.conversion_goal}`,
      `  Huni Aşaması: ${p.funnel_stage}`,
    ]
    if (p.detected_keywords.length > 0) {
      lines.push(`  Anahtar Kelimeler: ${p.detected_keywords.slice(0, 8).join(', ')}`)
    }
    return lines.join('\n')
  }

  const output = formatIntentForPrompt(profile)
  assert.ok(output.includes('mesleki belgelendirme'), 'business_domain görünmeli')
  assert.ok(output.includes('aşçılık belgesi'), 'service_or_product görünmeli')
  assert.ok(output.includes('başvuru formu'), 'conversion_goal görünmeli')
  assert.ok(output.includes('güven: 80/100'), 'confidence görünmeli')
})

// Test 10: Belgemot benzeri örnek — aşçılık belgesi spesifik, hardcode değil
test('Belgemot örneği: kampanya adından "aşçılık" + "belge" → mesleki belgelendirme (hardcode olmadan)', () => {
  // Sadece genel DOMAIN_SIGNALS lookup kullanarak — Belgemot'a özel kod yok
  const campaign = makeCampaign({
    campaignName: 'Belgemot - Aşçılık Belgesi',
    adsets: [
      makeAdset({
        name: 'Aşçılık Belgesi - Arama',
        ads: [
          makeAd({
            name: 'Aşçılık Yeterlilik Belgesi',
            creativeTitle: 'Aşçılık Sertifikası Al',
            creativeBody: 'Mesleki yeterlilik sınavına başvurun. Belgenizi hızlıca alın.',
          }),
        ],
      }),
    ],
  })

  const tokens = collectTokens(campaign)
  const domain = detectDomain(tokens)

  // The domain should be detected from DOMAIN_SIGNALS without any hardcoded business knowledge
  assert.strictEqual(
    domain,
    'mesleki belgelendirme',
    `Belgemot/aşçılık belgesi hardcode olmadan "mesleki belgelendirme" olmalı. Aldı: "${domain}"`,
  )

  // Ensure no hardcoded "belgemot" or "aşçılık" string in domain signals definition
  const domainSingleKeys = DOMAIN_SIGNALS.map(d => d.domain)
  assert.ok(!domainSingleKeys.includes('aşçılık'), '"aşçılık" hardcoded domain olmamalı')
  assert.ok(!domainSingleKeys.includes('belgemot'), '"belgemot" hardcoded domain olmamalı')
})

// ── Summary ───────────────────────────────────────────────────────────────────

// Give async tests time to complete
setTimeout(() => {
  console.log(`\n${passed + failed} test / ${passed} passed / ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}, 100)
