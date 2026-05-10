/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Synthesis Engine v2 (Faz 3)

   Deterministik birleştirici. AI proposal generator'a verilmek
   üzere: kampanya performansı + diagnosis + Faz 1 doctrine +
   Faz 2 rakip içgörüsünü tek normalize pakete sıkıştırır.

   Kurallar:
   - Bu fazda LLM yok; tüm karar deterministik.
   - Crash etmez; missing alanlarda nötr fallback üretir.
   - Kampanya türü sadakatini zorla: forbidden moves yazılır.
   - Output schema (FullAdProposal) DEĞİŞMEZ; bu sadece
     prompt context için zenginleştirilmiş bir kaynak.
   ────────────────────────────────────────────────────────── */

import type {
  DeepCampaignInsight,
  Platform,
  RiskLevel,
} from './analysisTypes'
import type { PlatformDoctrine } from './platformDoctrineStore'
import {
  normalizeCampaignType,
  scoreDoctrineFit,
  type NormalizedCampaignType,
  type DoctrineFitResult,
  type CampaignTypeKey,
} from './campaignTypeIntelligence'
import { getDoctrineMap } from './platformDoctrineStore'
import type { CompetitorInsightRow } from './competitorInsightStore'
import { getLatestCompetitorInsight } from './competitorInsightStore'
import type {
  CampaignSynthesisPackage,
  CampaignSynthesisSource,
  CompetitorSnapshot,
  DiagnosisSnapshot,
  DoctrineSnapshot,
  PerformanceSnapshot,
  SynthesisConfidence,
  SynthesisEngineResult,
  SynthesisInput,
  SynthesisOpportunity,
  SynthesisRecommendationConstraint,
  SynthesisRisk,
  SynthesisSummary,
} from './synthesisTypes'

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

function safeNumber(v: unknown, fallback = 0): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return v
}

function asStringArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((x) => (typeof x === 'string' ? x : x == null ? null : String(x)))
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  }
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (typeof value === 'object') {
    // doctrine field'ları çoğunlukla {primary:[...], required:[...], principles:[...]}
    const o = value as Record<string, unknown>
    const candidates: string[] = []
    for (const key of [
      'primary',
      'required',
      'principles',
      'rules',
      'list',
      'items',
      'must',
      'avoid',
    ]) {
      if (Array.isArray(o[key])) {
        for (const item of o[key] as unknown[]) {
          if (typeof item === 'string' && item.trim()) candidates.push(item.trim())
          else if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>
            const label =
              (typeof obj.name === 'string' && obj.name) ||
              (typeof obj.title === 'string' && obj.title) ||
              (typeof obj.id === 'string' && obj.id) ||
              null
            if (label) candidates.push(label)
          }
        }
      }
    }
    return candidates
  }
  return []
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function uniq(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x)
      out.push(x)
    }
  }
  return out
}

function trimTo(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

/* ──────────────────────────────────────────────────────────
   summarizePerformanceSnapshot
   adCreator currentParams ile uyumlu CTR (% cinsinden) verir.
   ────────────────────────────────────────────────────────── */
export function summarizePerformanceSnapshot(
  campaign: DeepCampaignInsight,
): PerformanceSnapshot {
  const m = campaign.metrics
  const impressions = safeNumber(m?.impressions, 0)
  const clicks = safeNumber(m?.clicks, 0)
  const spend = safeNumber(m?.spend, 0)
  // m.ctr deepFetcher tarafında 0..1 olarak yazılıyor olabilir; adCreator
  // *100 ile sunuyor. Synthesis snapshot'ı da % cinsinden yayınlar.
  const rawCtr = safeNumber(m?.ctr, 0)
  const ctrPct = rawCtr <= 1 ? rawCtr * 100 : rawCtr
  const cpc = safeNumber(m?.cpc, 0)
  const conversions = safeNumber(m?.conversions, 0)
  const cpm = safeNumber(m?.cpm, impressions > 0 ? (spend / impressions) * 1000 : 0)
  const roas = m?.roas ?? null
  const frequency = m?.frequency ?? null

  return {
    spend,
    impressions,
    clicks,
    ctr: Number(ctrPct.toFixed(2)),
    cpc: Number(cpc.toFixed(2)),
    conversions,
    cpm: Number(cpm.toFixed(2)),
    roas: roas == null ? null : Number(roas.toFixed(2)),
    frequency: frequency == null ? null : Number(frequency.toFixed(2)),
  }
}

/* ──────────────────────────────────────────────────────────
   extractDiagnosisSignals
   Bu faz Meta diagnose modülünü ÇAĞIRMAZ; o modüle dokunmamak
   için sadece ProblemTag listesini ve metrik tabanlı kuralları
   yorumlar. Daha derin diagnosis işlemi mevcut deepAnalysis
   pipeline'ında zaten yapılıyor.
   ────────────────────────────────────────────────────────── */
export function extractDiagnosisSignals(
  campaign: DeepCampaignInsight,
): DiagnosisSnapshot {
  const rootCauses: string[] = []
  const opportunities: string[] = []
  const recommendedActions: string[] = []
  const m = campaign.metrics
  const ctrPct = (m?.ctr ?? 0) <= 1 ? (m?.ctr ?? 0) * 100 : (m?.ctr ?? 0)
  const spend = safeNumber(m?.spend, 0)
  const conversions = safeNumber(m?.conversions, 0)
  const clicks = safeNumber(m?.clicks, 0)
  const cpc = safeNumber(m?.cpc, 0)
  const freq = safeNumber(m?.frequency, 0)
  const roas = m?.roas

  if (spend > 200 && conversions === 0) {
    rootCauses.push('Yüksek harcama, sıfır dönüşüm — tracking veya offer-fit problemi olabilir.')
    recommendedActions.push('Dönüşüm pikselini/conversion event mapping doğrula.')
  }
  if (ctrPct > 0 && ctrPct < 0.5) {
    rootCauses.push('CTR çok düşük — kreatif/headline veya hedefleme alaka problemi.')
    recommendedActions.push('Yeni hook ve daha keskin value-prop ile creative refresh.')
  }
  if (cpc > 15) {
    rootCauses.push('CPC normalin üzerinde — açık artırma rekabeti veya düşük relevance.')
    recommendedActions.push('Daha dar hedefleme veya alternatif placement testi.')
  }
  if (freq > 4) {
    rootCauses.push(`Frequency yüksek (${freq.toFixed(1)}) — kreatif yorgunluğu riski.`)
    recommendedActions.push('Audience genişlet veya yeni creative variant ekle.')
  }
  if (roas != null && roas < 1 && spend > 200) {
    rootCauses.push(`ROAS ${roas.toFixed(2)}x — bütçe zarar üretiyor.`)
    recommendedActions.push('Düşük ROAS adset/asset durdur, kazananları ölçeklendir.')
  }

  if (clicks > 0 && conversions > 0 && (cpc === 0 || cpc < 5)) {
    opportunities.push('CPC görece düşük — mesaj/creative testi ile dönüşümü ölçeklendir.')
  }
  if (ctrPct >= 1.5) {
    opportunities.push(`CTR güçlü (%${ctrPct.toFixed(1)}) — landing-page optimizasyonu dönüşümü artırabilir.`)
  }
  if (campaign.score != null && campaign.score >= 70) {
    opportunities.push('Skor yüksek — bütçe artışına aday.')
  }

  // problemTags zaten DeepCampaignInsight içinde var; sadece id listesini al.
  const problemTagIds = (campaign.problemTags || [])
    .map((p) => (typeof p === 'object' && p && 'id' in p ? String((p as { id: unknown }).id) : ''))
    .filter((s) => s.length > 0)

  // Kampanya genel risk seviyesi.
  const riskLevel: RiskLevel = campaign.riskLevel || 'medium'

  return {
    rootCauses: uniq(rootCauses),
    problemTags: uniq(problemTagIds),
    riskLevel,
    opportunities: uniq(opportunities),
    recommendedActions: uniq(recommendedActions),
  }
}

/* ──────────────────────────────────────────────────────────
   mergeDoctrineSignals
   Faz 1 doctrine + fit sonuçlarını DoctrineSnapshot'a sıkıştırır.
   ────────────────────────────────────────────────────────── */
export function mergeDoctrineSignals(
  doctrine: PlatformDoctrine | null,
  fit: DoctrineFitResult | null,
): DoctrineSnapshot {
  if (!doctrine) {
    return {
      available: false,
      name: null,
      description: null,
      successMetrics: [],
      failureSignals: [],
      requiredAssets: [],
      biddingPrinciples: [],
      creativePrinciples: [],
      targetingPrinciples: [],
      policyNotes: [],
      fitScore: null,
      fitSeverity: null,
      matchedPrinciples: [],
      missingRequirements: [],
      recommendedChecks: [],
    }
  }

  const successMetrics = asStringArray(doctrine.success_metrics)
  const failureSignals = asStringArray(doctrine.failure_signals)
  const requiredAssets = asStringArray(doctrine.required_assets)
  const biddingPrinciples = asStringArray(doctrine.bidding_principles)
  const creativePrinciples = asStringArray(doctrine.creative_principles)
  const targetingPrinciples = asStringArray(doctrine.targeting_principles)
  const policyNotes = asStringArray(doctrine.policy_notes)

  return {
    available: true,
    name: doctrine.name || null,
    description: doctrine.description || null,
    successMetrics,
    failureSignals,
    requiredAssets,
    biddingPrinciples,
    creativePrinciples,
    targetingPrinciples,
    policyNotes,
    fitScore: fit ? fit.score : null,
    fitSeverity: fit ? fit.severity : null,
    matchedPrinciples: fit?.matchedPrinciples || [],
    missingRequirements: fit?.missingRequirements || [],
    recommendedChecks: fit?.recommendedChecks || [],
  }
}

/* ──────────────────────────────────────────────────────────
   mergeCompetitorSignals
   Faz 2 CompetitorInsightRow → CompetitorSnapshot.
   Yoksa available=false; halüsinasyon yapılmaz.
   ────────────────────────────────────────────────────────── */
export function mergeCompetitorSignals(
  insight: CompetitorInsightRow | null,
): CompetitorSnapshot {
  if (!insight || insight.ads_count === 0) {
    return {
      available: false,
      adsCount: 0,
      topHooks: [],
      topCtas: [],
      topValueProps: [],
      commonPhrases: [],
      offerPatterns: [],
      creativePatterns: [],
      competitorSummary: 'Rakip içgörüsü kayıtlı değil.',
      confidence: 0,
    }
  }
  return {
    available: true,
    adsCount: insight.ads_count,
    topHooks: (insight.top_hooks || []).slice(0, 6).map((h) => h.token),
    topCtas: (insight.top_ctas || []).slice(0, 4).map((c) => c.cta),
    topValueProps: (insight.top_value_props || []).slice(0, 6).map((v) => v.token),
    commonPhrases: (insight.common_phrases || []).slice(0, 6),
    offerPatterns: (insight.offer_patterns || []).slice(0, 6).map((o) => o.token),
    creativePatterns: insight.creative_patterns || [],
    competitorSummary: insight.competitor_summary || '',
    confidence: clamp(safeNumber(insight.confidence, 0), 0, 100),
  }
}

/* ──────────────────────────────────────────────────────────
   Campaign type sadakati — yasak hareket listeleri.

   Synthesis Engine, AI proposal generator'a kampanya türünü
   asla değiştirmemesi gerektiğini açıkça söyler. Bu liste
   aynı zamanda "forbiddenMoves" olarak prompt'a yazılır.
   ────────────────────────────────────────────────────────── */
function buildForbiddenMoves(
  campaignType: CampaignTypeKey | string,
  platform: Platform,
): string[] {
  const out: string[] = []
  switch (campaignType) {
    case 'meta_traffic':
      out.push(
        'Sales/Engagement objective öneme — kampanya OUTCOME_TRAFFIC olarak kalmalı.',
        'Lead form objective\'ine geçme — bu kampanya trafik kampanyası.',
      )
      break
    case 'meta_engagement':
      out.push(
        'Sales/Lead objective\'ine geçme — kampanya OUTCOME_ENGAGEMENT olarak kalmalı.',
        'Conversion event önerme; bu kampanya etkileşim için kuruldu.',
      )
      break
    case 'meta_message':
      out.push(
        'WhatsApp/Messenger/IG DM hedefini bırakıp web traffic veya sales objective önerme.',
        'Messaging conversation hedefini değiştirme; aynı mesaj akışında kal.',
      )
      break
    case 'meta_lead':
      out.push(
        'Form/lead hedefini bırakıp engagement/sales objective önerme.',
        'Lead form yerine conversion event önerme; kampanya OUTCOME_LEADS olarak kalmalı.',
      )
      break
    case 'meta_sales':
      out.push(
        'Engagement/Traffic objective önerme; kampanya OUTCOME_SALES olarak kalmalı.',
        'Pixel/conversion event yerine reach/awareness önerme.',
      )
      break
    case 'meta_awareness':
      out.push(
        'Sales/Lead objective önerme; kampanya OUTCOME_AWARENESS olarak kalmalı.',
      )
      break
    case 'google_search':
      out.push(
        'Display kreatif/responsive display ad önerme; kampanya SEARCH olarak kalmalı.',
        'Video asset önerme; bu kampanya arama metin reklamı.',
      )
      break
    case 'google_display':
      out.push(
        'Search keyword expansion ana öneri olamaz; kampanya DISPLAY olarak kalmalı.',
        'Search RSA önerme; bu kampanya display görsel reklam.',
      )
      break
    case 'google_video':
      out.push(
        'Search RSA veya display banner önerme; kampanya VIDEO olarak kalmalı.',
        'Video hook/CTA odağını terk etme — ilk 5 saniye kritik.',
      )
      break
    case 'google_pmax':
      out.push(
        'Tek kanal (sadece search veya display) önerme; PMax tüm envanter için.',
        'Asset group / audience signal / conversion goal bağlamı dışına çıkma.',
      )
      break
    default:
      // unknown — sadece genel kural
      out.push(
        `Kampanya tipi (${campaignType}) net belirlenmedi; mevcut platform/objective\'i değiştirmeden öneri üret.`,
      )
  }
  // Genel kural her tipe eklensin.
  out.push(
    `Kampanya türü (${platform}/${campaignType}) DEĞİŞTİRİLEMEZ — proposal aynı türde optimizasyon olmalı.`,
  )
  return uniq(out)
}

/* ──────────────────────────────────────────────────────────
   decideMainProblem / decideMainOpportunity
   ────────────────────────────────────────────────────────── */
export function decideMainProblem(
  perf: PerformanceSnapshot,
  doctrine: DoctrineSnapshot,
  diagnosis: DiagnosisSnapshot,
): string {
  // Önce doctrine fit kritik mi?
  if (doctrine.available && doctrine.fitSeverity === 'critical') {
    return `Doctrine uyumsuzluğu kritik — ${doctrine.name || 'kampanya türü'} prensiplerinden sapma.`
  }
  // Sonra metrik tabanlı net problemler.
  if (perf.spend > 200 && perf.conversions === 0) {
    return 'Yüksek harcama ama sıfır dönüşüm — tracking veya offer-fit problemi.'
  }
  if (perf.ctr > 0 && perf.ctr < 0.5) {
    return `CTR çok düşük (%${perf.ctr.toFixed(2)}) — kreatif/hedefleme alaka problemi.`
  }
  if (perf.roas != null && perf.roas < 1 && perf.spend > 200) {
    return `ROAS 1x altında (${perf.roas.toFixed(2)}x) — bütçe zarar üretiyor.`
  }
  if ((perf.frequency ?? 0) > 4) {
    return `Frequency yüksek (${(perf.frequency ?? 0).toFixed(1)}) — kreatif yorgunluğu.`
  }
  if (diagnosis.rootCauses.length > 0) {
    return diagnosis.rootCauses[0]
  }
  if (doctrine.available && doctrine.fitSeverity === 'high') {
    return `Doctrine fit zayıf — ${doctrine.recommendedChecks[0] || 'doctrine kontrolleri uygulanmalı'}.`
  }
  if (perf.spend === 0 && perf.impressions === 0) {
    return 'Kampanya delivery üretmiyor — review/budget/audience kontrol gerekiyor.'
  }
  return 'Belirgin kritik problem tespit edilmedi; mevcut yapı korunarak iyileştirme önerilebilir.'
}

export function decideMainOpportunity(
  perf: PerformanceSnapshot,
  doctrine: DoctrineSnapshot,
  diagnosis: DiagnosisSnapshot,
  competitor: CompetitorSnapshot,
): string {
  if (competitor.available && competitor.topHooks.length > 0) {
    return `Rakipler "${competitor.topHooks.slice(0, 3).join(', ')}" hook'larını kullanıyor — bu açıyla yeni kreatif test edilebilir.`
  }
  if (doctrine.available && doctrine.matchedPrinciples.length > 0) {
    return `Doctrine ile uyumlu pozitif sinyaller var (${doctrine.matchedPrinciples[0]}); aynı yön korunarak ölçeklendirme önerilebilir.`
  }
  if (diagnosis.opportunities.length > 0) {
    return diagnosis.opportunities[0]
  }
  if (perf.ctr >= 1.5) {
    return `CTR güçlü (%${perf.ctr.toFixed(1)}); landing-page optimizasyonu dönüşümü açabilir.`
  }
  if (perf.conversions > 0 && (perf.cpc === 0 || perf.cpc < 5)) {
    return 'CPC görece düşük; mesaj/creative testi ile dönüşüm ölçeklendirilebilir.'
  }
  return 'Kazançlı net açı tespit edilmedi; mevcut creative/targeting küçük varyasyonlarla test edilebilir.'
}

/* ──────────────────────────────────────────────────────────
   Confidence
   ────────────────────────────────────────────────────────── */
function buildConfidence(
  doctrine: DoctrineSnapshot,
  competitor: CompetitorSnapshot,
  normalized: NormalizedCampaignType,
  perf: PerformanceSnapshot,
): SynthesisConfidence {
  let score = 30 // neutral start
  const reasons: string[] = []

  // normalize confidence katkısı
  score += clamp(normalized.confidence, 0, 100) * 0.3
  reasons.push(`type_normalize=${normalized.confidence}`)

  if (doctrine.available) {
    score += 15
    reasons.push('doctrine_loaded')
    if (doctrine.fitScore != null) {
      score += (doctrine.fitScore - 50) * 0.1
      reasons.push(`doctrine_fit=${doctrine.fitScore}`)
    }
  } else {
    reasons.push('doctrine_missing')
  }

  if (competitor.available) {
    score += clamp(competitor.confidence, 0, 100) * 0.15
    reasons.push(`competitor_conf=${competitor.confidence}`)
  } else {
    reasons.push('competitor_missing')
  }

  if (perf.spend === 0 && perf.impressions === 0) {
    score -= 15
    reasons.push('no_delivery_data')
  }

  const finalScore = clamp(Math.round(score), 0, 100)
  const level: SynthesisConfidence['level'] =
    finalScore >= 70 ? 'high' : finalScore >= 45 ? 'medium' : 'low'

  return { score: finalScore, level, reasons }
}

/* ──────────────────────────────────────────────────────────
   Risk / opportunity / constraint adapter
   ────────────────────────────────────────────────────────── */
function buildStructuredRisks(
  doctrine: DoctrineSnapshot,
  diagnosis: DiagnosisSnapshot,
  perf: PerformanceSnapshot,
): SynthesisRisk[] {
  const out: SynthesisRisk[] = []

  if (doctrine.available && doctrine.fitSeverity) {
    const sev = doctrine.fitSeverity
    if (sev === 'high' || sev === 'critical') {
      out.push({
        id: `doctrine_fit_${sev}`,
        origin: 'doctrine',
        severity: sev,
        message: `Doctrine fit ${sev}: ${doctrine.failureSignals.slice(0, 2).join(', ') || doctrine.recommendedChecks[0] || 'detaylar promp\'ta'}`.trim(),
      })
    }
  }
  for (const cause of diagnosis.rootCauses.slice(0, 4)) {
    out.push({
      id: `diagnosis_${out.length + 1}`,
      origin: 'diagnosis',
      severity: diagnosis.riskLevel === 'critical' ? 'critical' : 'medium',
      message: cause,
    })
  }
  if (perf.spend > 0 && perf.conversions === 0 && perf.spend > 500) {
    out.push({
      id: 'composite_spend_no_conv',
      origin: 'composite',
      severity: 'critical',
      message: 'Yüksek harcama + sıfır dönüşüm: tracking/offer-fit kritik.',
    })
  }
  return out
}

function buildStructuredOpportunities(
  doctrine: DoctrineSnapshot,
  competitor: CompetitorSnapshot,
  diagnosis: DiagnosisSnapshot,
): SynthesisOpportunity[] {
  const out: SynthesisOpportunity[] = []
  if (competitor.available && competitor.topHooks.length > 0) {
    out.push({
      id: 'competitor_hooks',
      origin: 'competitor',
      message: `Rakipler ${competitor.topHooks.slice(0, 3).join(', ')} hook'larını kullanıyor.`,
    })
  }
  if (doctrine.available && doctrine.matchedPrinciples.length > 0) {
    out.push({
      id: 'doctrine_match',
      origin: 'doctrine',
      message: `Doctrine pozitif eşleşme: ${doctrine.matchedPrinciples.slice(0, 2).join(', ')}`,
    })
  }
  for (const opp of diagnosis.opportunities.slice(0, 3)) {
    out.push({
      id: `diagnosis_opp_${out.length + 1}`,
      origin: 'diagnosis',
      message: opp,
    })
  }
  return out
}

function buildConstraints(
  forbidden: string[],
): SynthesisRecommendationConstraint[] {
  return forbidden.map((msg, i) => ({ id: `forbidden_${i + 1}`, message: msg }))
}

/* ──────────────────────────────────────────────────────────
   buildProposalBrief — AI promptuna yazılacak kompakt blok
   ────────────────────────────────────────────────────────── */
export function buildProposalBrief(
  pkg: Pick<
    CampaignSynthesisPackage,
    | 'platform'
    | 'campaignType'
    | 'campaignName'
    | 'performanceSnapshot'
    | 'doctrine'
    | 'diagnosis'
    | 'competitor'
    | 'synthesis'
  >,
): string {
  const perf = pkg.performanceSnapshot
  const lines: string[] = []
  lines.push(
    `SYNTHESIS — ${pkg.platform}/${pkg.campaignType} · ${pkg.campaignName}`,
  )
  lines.push(`- Main problem: ${pkg.synthesis.mainProblem}`)
  lines.push(`- Main opportunity: ${pkg.synthesis.mainOpportunity}`)
  if (pkg.doctrine.available) {
    const sev = pkg.doctrine.fitSeverity ? ` (fit:${pkg.doctrine.fitSeverity})` : ''
    lines.push(
      `- Doctrine${sev}: ${pkg.doctrine.name || pkg.campaignType}${pkg.doctrine.missingRequirements.length > 0 ? ` · missing: ${pkg.doctrine.missingRequirements.slice(0, 2).join(', ')}` : ''}`,
    )
  } else {
    lines.push('- Doctrine: kayıt yok — neutral fallback.')
  }
  if (pkg.competitor.available) {
    lines.push(
      `- Rakip: ${pkg.competitor.adsCount} reklam${pkg.competitor.topHooks.length > 0 ? `, hook: ${pkg.competitor.topHooks.slice(0, 3).join(', ')}` : ''}${pkg.competitor.topCtas.length > 0 ? `, CTA: ${pkg.competitor.topCtas.slice(0, 2).join(', ')}` : ''}`,
    )
  } else {
    lines.push('- Rakip içgörüsü: yok — uydurma yapma, kendi kampanya bağlamına odaklan.')
  }
  lines.push(
    `- Recommended angle: ${pkg.synthesis.recommendedAngle}`,
  )
  lines.push(`- Creative: ${pkg.synthesis.creativeDirection}`)
  lines.push(`- Targeting: ${pkg.synthesis.targetingDirection}`)
  lines.push(`- Bidding: ${pkg.synthesis.biddingDirection}`)
  lines.push(
    `- Forbidden: ${pkg.synthesis.forbiddenMoves.slice(0, 3).join(' | ')}`,
  )
  lines.push(
    `- Evidence: spend ₺${perf.spend.toFixed(0)} · CTR %${perf.ctr.toFixed(2)} · conv ${perf.conversions}${perf.roas != null ? ` · ROAS ${perf.roas}x` : ''}${pkg.competitor.available ? ` · rakip ${pkg.competitor.adsCount}` : ''}`,
  )
  return trimTo(lines.join('\n'), 1000)
}

/* ──────────────────────────────────────────────────────────
   buildSynthesisContextForPrompt
   adCreator buradan çekecek — paket sıralı string blok.
   ────────────────────────────────────────────────────────── */
export function buildSynthesisContextForPrompt(
  pkg: CampaignSynthesisPackage,
): string {
  return pkg.synthesis.proposalBrief
}

/* ──────────────────────────────────────────────────────────
   buildCampaignSynthesisPackage — tek kampanya için
   ────────────────────────────────────────────────────────── */
export function buildCampaignSynthesisPackage(
  input: SynthesisInput,
): CampaignSynthesisPackage {
  const { campaign, doctrine, competitorInsight } = input
  const normalized =
    input.normalizedCampaignType || normalizeCampaignType(campaign)
  const fit =
    input.doctrineFit || scoreDoctrineFit(campaign, doctrine || null)

  const perf = summarizePerformanceSnapshot(campaign)
  const doctrineSnap = mergeDoctrineSignals(doctrine || null, fit)
  const diagnosis = extractDiagnosisSignals(campaign)
  const competitor = mergeCompetitorSignals(competitorInsight || null)

  const forbiddenMoves = buildForbiddenMoves(normalized.campaignType, campaign.platform)
  const mainProblem = decideMainProblem(perf, doctrineSnap, diagnosis)
  const mainOpportunity = decideMainOpportunity(perf, doctrineSnap, diagnosis, competitor)

  // Yön cümleleri — deterministik kompozisyon.
  const recommendedAngle = competitor.available && competitor.topHooks.length > 0
    ? `Rakip hook'larından (${competitor.topHooks.slice(0, 2).join(', ')}) ilham al, ama kampanya türünden sapma.`
    : `Mevcut kampanya türünün başarı kriterlerine sadık kal: ${doctrineSnap.successMetrics.slice(0, 3).join(', ') || 'doctrine bilinmiyor'}`

  const creativeDirection = doctrineSnap.creativePrinciples.length > 0
    ? `Doctrine kreatif prensipleri: ${doctrineSnap.creativePrinciples.slice(0, 2).join(' / ')}`
    : (perf.ctr < 0.5
        ? 'Daha keskin headline + value-prop, ilk 1 saniyede attention.'
        : 'Mevcut kazanan açıyı koru, küçük varyantlarla A/B test.')

  const targetingDirection = doctrineSnap.targetingPrinciples.length > 0
    ? `Doctrine hedefleme prensipleri: ${doctrineSnap.targetingPrinciples.slice(0, 2).join(' / ')}`
    : ((perf.frequency ?? 0) > 4
        ? 'Audience genişlet veya creative rotation; frequency yüksek.'
        : 'Mevcut audience korunsun; küçük lookalike denemesi yapılabilir.')

  const biddingDirection = doctrineSnap.biddingPrinciples.length > 0
    ? `Doctrine bidding prensipleri: ${doctrineSnap.biddingPrinciples.slice(0, 2).join(' / ')}`
    : (perf.conversions >= 15
        ? 'Conversion tabanlı stratejiye geçişe aday (örn. MAXIMIZE_CONVERSIONS).'
        : 'Click/cost tabanlı stratejide kal; conversion verisi yetersiz.')

  const evidence: string[] = []
  evidence.push(`spend=${perf.spend}`)
  evidence.push(`ctr=${perf.ctr}%`)
  evidence.push(`cpc=${perf.cpc}`)
  evidence.push(`conv=${perf.conversions}`)
  if (perf.roas != null) evidence.push(`roas=${perf.roas}x`)
  if (perf.frequency != null) evidence.push(`freq=${perf.frequency}`)
  if (doctrineSnap.available && doctrineSnap.fitScore != null) {
    evidence.push(`doctrine_fit=${doctrineSnap.fitScore}/${doctrineSnap.fitSeverity}`)
  }
  if (competitor.available) evidence.push(`competitor_ads=${competitor.adsCount}`)

  const confidence = buildConfidence(doctrineSnap, competitor, normalized, perf)

  // SynthesisSummary önce inşa et — proposalBrief en sonda.
  const partialSummary: Omit<SynthesisSummary, 'proposalBrief'> = {
    mainProblem,
    mainOpportunity,
    recommendedAngle,
    creativeDirection,
    targetingDirection,
    biddingDirection,
    mustKeepCampaignType: true,
    forbiddenMoves,
    confidence,
    evidence,
  }

  // Source meta
  const source: CampaignSynthesisSource = {
    campaign: 'deepCampaignInsight',
    doctrine: doctrine
      ? input.meta?.doctrineSource === 'fallback'
        ? 'fallback'
        : 'db'
      : 'missing',
    competitor: competitorInsight ? 'db' : 'missing',
    doctrineDetail: doctrine ? `${doctrine.name || doctrine.campaign_type}` : null,
    competitorDetail:
      input.meta?.competitorDetail ?? (competitorInsight ? competitorInsight.generated_at : null),
  }

  // Şimdi proposalBrief'i doldurmak için pkg-light obje oluştur.
  const summaryWithBrief: SynthesisSummary = {
    ...partialSummary,
    proposalBrief: '',
  }

  const pkgPartial: CampaignSynthesisPackage = {
    campaignId: campaign.id,
    platform: campaign.platform,
    campaignType: normalized.campaignType,
    campaignName: campaign.campaignName,
    sourceCampaignStatus: campaign.status,
    performanceSnapshot: perf,
    doctrine: doctrineSnap,
    diagnosis,
    competitor,
    synthesis: summaryWithBrief,
    source,
    normalized,
    risks: buildStructuredRisks(doctrineSnap, diagnosis, perf),
    opportunities: buildStructuredOpportunities(doctrineSnap, competitor, diagnosis),
    constraints: buildConstraints(forbiddenMoves),
    generatedAt: new Date().toISOString(),
  }

  // proposalBrief artık paket kullanıyor.
  pkgPartial.synthesis.proposalBrief = buildProposalBrief(pkgPartial)

  return pkgPartial
}

/* ──────────────────────────────────────────────────────────
   buildSynthesisPackagesForCampaigns
   Birden fazla kampanya için çağrılır. Doctrine map'i ve
   userId varsa kalıcı competitor insight'ı kendisi çeker.
   ────────────────────────────────────────────────────────── */
export interface BuildSynthesisOptions {
  /** Faz 2 competitor insight fetch'i için userId. Yoksa rakip nötr. */
  userId?: string | null
  /** Önceden hazırlanmış doctrine map (request başına tek fetch için). */
  doctrineMap?: Record<string, PlatformDoctrine>
  /**
   * platformLower(meta|google) → CompetitorInsightRow.
   * Çağıran tarafından önceden çekilebilir; verilmezse engine
   * her unique platform için bir kez fetch eder.
   */
  competitorMap?: Record<string, CompetitorInsightRow | null>
}

export async function buildSynthesisPackagesForCampaigns(
  campaigns: DeepCampaignInsight[],
  options: BuildSynthesisOptions = {},
): Promise<SynthesisEngineResult> {
  const warnings: string[] = []
  const packages: CampaignSynthesisPackage[] = []
  const packageMap: Record<string, CampaignSynthesisPackage> = {}

  // Doctrine map'i hazırla.
  let doctrineMap = options.doctrineMap
  if (!doctrineMap) {
    try {
      doctrineMap = await getDoctrineMap()
    } catch (e) {
      warnings.push(`doctrineMap_fetch_failed: ${e instanceof Error ? e.message : String(e)}`)
      doctrineMap = {}
    }
  }

  // Competitor map'i hazırla.
  const competitorMap: Record<string, CompetitorInsightRow | null> =
    { ...(options.competitorMap || {}) }
  const userId = options.userId || null

  for (const c of campaigns) {
    try {
      const normalized = normalizeCampaignType(c)
      const doctrine = doctrineMap?.[normalized.campaignType] || null
      const fit = scoreDoctrineFit(c, doctrine)

      // Competitor lookup: önce platformLower + campaignType, sonra platformLower.
      const platformLower = c.platform === 'Meta' ? 'meta' : 'google'
      let competitor: CompetitorInsightRow | null = null

      const ctxKey = `${platformLower}:${normalized.campaignType}`
      const platformKey = `${platformLower}`

      if (Object.prototype.hasOwnProperty.call(competitorMap, ctxKey)) {
        competitor = competitorMap[ctxKey]
      } else if (Object.prototype.hasOwnProperty.call(competitorMap, platformKey)) {
        competitor = competitorMap[platformKey]
      } else if (userId) {
        try {
          competitor = await getLatestCompetitorInsight(userId, {
            platform: platformLower,
            campaign_type_context: normalized.campaignType,
          })
          if (!competitor) {
            competitor = await getLatestCompetitorInsight(userId, {
              platform: platformLower,
            })
          }
          competitorMap[ctxKey] = competitor
        } catch (e) {
          warnings.push(
            `competitor_fetch_failed:${platformLower}/${normalized.campaignType}:${e instanceof Error ? e.message : String(e)}`,
          )
          competitor = null
        }
      }

      const pkg = buildCampaignSynthesisPackage({
        campaign: c,
        doctrine,
        normalizedCampaignType: normalized,
        doctrineFit: fit,
        competitorInsight: competitor,
        meta: {
          doctrineSource: doctrine ? 'db' : 'missing',
          competitorDetail: competitor ? competitor.generated_at : null,
        },
      })
      packages.push(pkg)
      packageMap[c.id] = pkg
    } catch (e) {
      warnings.push(`build_failed:${c.id}:${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return {
    packages,
    packageMap,
    warnings,
    count: packages.length,
    generatedAt: new Date().toISOString(),
  }
}
