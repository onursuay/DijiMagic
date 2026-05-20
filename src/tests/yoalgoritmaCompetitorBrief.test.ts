/**
 * YoAlgoritma — Competitor Ads Brief (A4) Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/yoalgoritmaCompetitorBrief.test.ts
 *
 * buildCompetitorAdsBrief — rakip insight + örnek reklamların
 * "Rakip Reklam Analizi" bloğuna doğru çevrildiğini; metinsiz
 * (Google) kayıtların dürüstçe işaretlendiğini; veri yoksa null
 * döndüğünü doğrular. buildUserBrief entegrasyonu da test edilir.
 */

import assert from 'assert'
import {
  buildCompetitorAdsBrief,
  type CompetitorBriefInput,
} from '../../lib/yoai/ai/competitorBrief'
import { buildUserBrief } from '../../lib/yoai/ai/systemPrompt'

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

function metaFixture(): CompetitorBriefInput {
  return {
    platform: 'Meta',
    insight: {
      ads_count: 12,
      active_advertisers_count: 3,
      top_hooks: [{ token: 'hemen', count: 5 }, { token: 'fırsat', count: 3 }],
      top_ctas: [{ cta: 'Send Message', count: 7 }],
      top_value_props: [{ token: 'sertifikalı', count: 4 }],
      offer_patterns: [{ token: 'indirim', count: 2 }],
      common_phrases: ['hemen al', 'teklif al'],
      competitor_summary: '12 rakip reklam analiz edildi.',
      confidence: 64,
      generated_at: '2026-05-18T10:00:00Z',
    },
    sampleAds: [
      { advertiser_name: 'VOC Akademi', ad_title: 'MYK Belgesi Hızlı', ad_body: 'Sınavsız belge fırsatı, hemen başvur!', call_to_action: 'Send Message', is_active: true },
      { advertiser_name: 'Üsküdar MYM', ad_title: 'Mesleki Yeterlilik', ad_body: 'Devlet onaylı belge', call_to_action: 'Learn More', is_active: true },
    ],
  }
}

test('Meta: insight özeti + örnek reklamlar render ediliyor', () => {
  const brief = buildCompetitorAdsBrief(metaFixture())
  assert.ok(brief, 'brief null olmamalı')
  assert.ok(brief!.includes('Rakip Reklam Analizi (Meta'), 'başlık yok')
  assert.ok(brief!.includes('VOC Akademi'), 'örnek reklamveren yok')
  assert.ok(brief!.includes('Send Message'), 'CTA yok')
  assert.ok(brief!.includes("hemen"), 'hook yok')
})

test('Google metinsiz örnekler "metin mevcut değil" olarak işaretleniyor', () => {
  const brief = buildCompetitorAdsBrief({
    platform: 'Google',
    insight: null,
    sampleAds: [
      { advertiser_name: 'Bayer Turk', ad_title: null, ad_body: null, call_to_action: null, is_active: true, text_available: false },
    ],
  })
  assert.ok(brief, 'brief null olmamalı (örnek var)')
  assert.ok(brief!.includes('Bayer Turk'), 'advertiser yok')
  assert.ok(brief!.includes('reklam metni mevcut değil'), 'metinsiz etiketi yok')
})

test('Veri yoksa (insight yok + örnek yok) null döner', () => {
  const brief = buildCompetitorAdsBrief({ platform: 'Meta', insight: null, sampleAds: [] })
  assert.strictEqual(brief, null)
})

test('insight var ama ads_count=0 ve örnek yok → null', () => {
  const brief = buildCompetitorAdsBrief({
    platform: 'Meta',
    insight: { ads_count: 0, active_advertisers_count: 0, top_hooks: [], top_ctas: [], top_value_props: [], offer_patterns: [], common_phrases: [], competitor_summary: null, confidence: 0, generated_at: null },
    sampleAds: [],
  })
  assert.strictEqual(brief, null)
})

test('buildUserBrief competitorContext bloğunu gömüyor', () => {
  const compBrief = buildCompetitorAdsBrief(metaFixture())!
  const userMsg = buildUserBrief({
    platform: 'Meta',
    accountId: 'act_1',
    industry: 'Eğitim',
    businessContext: '## Kullanıcının kendi marka beyanı\n- Marka: Belgemod',
    competitorContext: compBrief,
    accountSnapshot: { spend: 1 },
    campaignsDetail: [],
    benchmarks: {},
  })
  assert.ok(userMsg.includes('Rakip Reklam Analizi'), 'rakip bloğu user message içinde yok')
  assert.ok(userMsg.includes('VOC Akademi'), 'rakip örneği user message içinde yok')
  assert.ok(userMsg.includes('Belgemod'), 'iş bağlamı kaybolmuş')
})

test('competitorContext null ise user message rakip bloğu içermez', () => {
  const userMsg = buildUserBrief({
    platform: 'Google',
    accountId: 'act_1',
    competitorContext: null,
    accountSnapshot: {},
    campaignsDetail: [],
    benchmarks: {},
  })
  assert.ok(!userMsg.includes('Rakip Reklam Analizi'), 'rakip bloğu sızmış')
})

async function runAll(): Promise<void> {
  console.log('\nYoAlgoritma Competitor Brief (A4) testleri:\n')
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

runAll()
