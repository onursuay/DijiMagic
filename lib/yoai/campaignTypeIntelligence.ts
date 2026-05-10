/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Campaign Type Intelligence (Faz 1)

   Kampanyanın platformu + amacı + optimizasyon hedefi + kanal
   tipinden yola çıkarak normalize bir campaign type üretir
   (örn. meta_traffic, google_search, google_pmax). Mevcut
   doctrine kayıtlarıyla karşılaştırarak doctrine fit score'u
   üretir.

   Çıktılar:
   - normalizeCampaignType()   → NormalizedCampaignType
   - scoreDoctrineFit()        → DoctrineFitResult
   - buildCampaignTypeContext()→ AI proposal prompt için summary

   Tasarım kuralları:
   - Eksik field'a karşı dayanıklı (crash etmez).
   - Düşük confidence'ta açık warning verir.
   - Bilinmeyen kombinasyonlar için fallback: <platform>_unknown.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight } from './analysisTypes'
import type { PlatformDoctrine } from './platformDoctrineStore'

/* ── Types ── */

export type CampaignTypeKey =
  | 'meta_traffic'
  | 'meta_engagement'
  | 'meta_lead'
  | 'meta_message'
  | 'meta_sales'
  | 'meta_awareness'
  | 'google_search'
  | 'google_display'
  | 'google_video'
  | 'google_pmax'
  | 'meta_unknown'
  | 'google_unknown'
  | 'unknown'

export type DoctrineSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface NormalizedCampaignType {
  platform: 'meta' | 'google' | 'unknown'
  campaignType: CampaignTypeKey
  objective: string | null
  optimizationGoal: string | null
  channelType: string | null
  confidence: number // 0-100
  signals: string[]
  warnings: string[]
}

export interface DoctrineFitResult {
  /** 0-100; 100 = doctrine'a tam uyumlu, 0 = ciddi sapma */
  score: number
  /** Doctrine'ın gerektirdiği prensiplerden eşleşenler */
  matchedPrinciples: string[]
  /** Required asset ya da prensiplerden eksik olanlar */
  missingRequirements: string[]
  /** Tetiklenen failure signals */
  failureSignals: string[]
  /** AI/operatöre kontrol edilmesi önerilen noktalar */
  recommendedChecks: string[]
  severity: DoctrineSeverity
}

export interface CampaignTypeContext {
  normalized: NormalizedCampaignType
  doctrineFit: DoctrineFitResult | null
  /** AI prompt'una sıkıştırılmış kısa özet (≤500 char). */
  promptSummary: string
}

/* ── Helpers ── */

function safeUpper(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return value.trim().toUpperCase()
}

function safeLower(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return value.trim().toLowerCase()
}

function pushSignal(arr: string[], signal: string) {
  if (!arr.includes(signal)) arr.push(signal)
}

/* ──────────────────────────────────────────────────────────
   META: campaign objective + adset.optimization_goal +
   destination_type üçlüsünden campaign type üret.
   ────────────────────────────────────────────────────────── */

export function inferMetaCampaignType(
  campaign: Pick<DeepCampaignInsight, 'objective' | 'adsets'>,
): NormalizedCampaignType {
  const signals: string[] = []
  const warnings: string[] = []

  const objective = safeUpper(campaign.objective)
  // İlk active/aktif olmayan adset'in optimizationGoal/destinationType'ı reprezentatif kabul edilir.
  const firstAdset = campaign.adsets?.[0]
  const optimizationGoal = safeUpper(firstAdset?.optimizationGoal)
  const destinationType = safeUpper(firstAdset?.destinationType)

  if (objective) pushSignal(signals, `objective=${objective}`)
  if (optimizationGoal) pushSignal(signals, `opt_goal=${optimizationGoal}`)
  if (destinationType) pushSignal(signals, `destination=${destinationType}`)

  let campaignType: CampaignTypeKey = 'meta_unknown'
  let confidence = 30

  if (objective === 'OUTCOME_TRAFFIC') {
    campaignType = 'meta_traffic'
    confidence = 90
    if (optimizationGoal === 'LINK_CLICKS') {
      pushSignal(signals, 'opt_goal_link_clicks_acceptable')
    } else if (optimizationGoal === 'LANDING_PAGE_VIEWS') {
      pushSignal(signals, 'opt_goal_lp_views_preferred')
    }
  } else if (objective === 'OUTCOME_ENGAGEMENT') {
    if (
      optimizationGoal === 'CONVERSATIONS' ||
      optimizationGoal === 'REPLIES' ||
      destinationType === 'WHATSAPP' ||
      destinationType === 'MESSENGER' ||
      destinationType === 'INSTAGRAM_DIRECT'
    ) {
      campaignType = 'meta_message'
      confidence = 85
    } else {
      campaignType = 'meta_engagement'
      confidence = 80
    }
  } else if (objective === 'OUTCOME_LEADS') {
    campaignType = 'meta_lead'
    confidence = 90
  } else if (objective === 'OUTCOME_SALES') {
    campaignType = 'meta_sales'
    confidence = 90
  } else if (objective === 'OUTCOME_AWARENESS') {
    campaignType = 'meta_awareness'
    confidence = 90
  } else {
    // Legacy / non-OUTCOME_* objective'leri kibarca sınıflandır.
    if (objective?.includes('TRAFFIC') || objective === 'LINK_CLICKS') {
      campaignType = 'meta_traffic'
      confidence = 60
      warnings.push('legacy_objective_remapped_to_traffic')
    } else if (objective?.includes('ENGAGEMENT') || objective?.includes('POST_ENGAGEMENT')) {
      campaignType = 'meta_engagement'
      confidence = 60
      warnings.push('legacy_objective_remapped_to_engagement')
    } else if (objective?.includes('LEAD')) {
      campaignType = 'meta_lead'
      confidence = 60
      warnings.push('legacy_objective_remapped_to_lead')
    } else if (objective?.includes('CONVERSION') || objective?.includes('SALES')) {
      campaignType = 'meta_sales'
      confidence = 60
      warnings.push('legacy_objective_remapped_to_sales')
    } else if (objective?.includes('REACH') || objective?.includes('AWARENESS')) {
      campaignType = 'meta_awareness'
      confidence = 60
      warnings.push('legacy_objective_remapped_to_awareness')
    } else if (objective) {
      warnings.push(`unrecognized_meta_objective: ${objective}`)
    } else {
      warnings.push('no_objective_field')
    }
  }

  return {
    platform: 'meta',
    campaignType,
    objective,
    optimizationGoal,
    channelType: null,
    confidence,
    signals,
    warnings,
  }
}

/* ──────────────────────────────────────────────────────────
   GOOGLE: channelType + biddingStrategy üzerinden
   ────────────────────────────────────────────────────────── */

export function inferGoogleCampaignType(
  campaign: Pick<DeepCampaignInsight, 'channelType' | 'biddingStrategy'>,
): NormalizedCampaignType {
  const signals: string[] = []
  const warnings: string[] = []

  const channelType = safeUpper(campaign.channelType)
  const biddingStrategy = safeUpper(campaign.biddingStrategy)

  if (channelType) pushSignal(signals, `channel_type=${channelType}`)
  if (biddingStrategy) pushSignal(signals, `bidding=${biddingStrategy}`)

  let campaignType: CampaignTypeKey = 'google_unknown'
  let confidence = 30

  if (!channelType) {
    warnings.push('no_channel_type_field')
    return {
      platform: 'google',
      campaignType,
      objective: null,
      optimizationGoal: biddingStrategy,
      channelType,
      confidence,
      signals,
      warnings,
    }
  }

  if (channelType === 'SEARCH') {
    campaignType = 'google_search'
    confidence = 95
  } else if (channelType === 'DISPLAY') {
    campaignType = 'google_display'
    confidence = 95
  } else if (channelType === 'VIDEO') {
    campaignType = 'google_video'
    confidence = 95
  } else if (
    channelType === 'PERFORMANCE_MAX' ||
    channelType === 'PMAX' ||
    channelType === 'MULTI_CHANNEL'
  ) {
    campaignType = 'google_pmax'
    confidence = 95
  } else if (channelType === 'SHOPPING') {
    // Shopping bu fazda doctrine'a yok — pmax fallback (uyarıyla)
    campaignType = 'google_pmax'
    confidence = 50
    warnings.push('google_shopping_mapped_to_pmax_doctrine_temp')
  } else if (channelType === 'DISCOVERY' || channelType === 'DEMAND_GEN') {
    // Discovery/Demand Gen şimdilik display doctrine'a yakın
    campaignType = 'google_display'
    confidence = 55
    warnings.push('google_discovery_mapped_to_display_doctrine_temp')
  } else {
    warnings.push(`unrecognized_google_channel_type: ${channelType}`)
  }

  return {
    platform: 'google',
    campaignType,
    objective: null,
    optimizationGoal: biddingStrategy,
    channelType,
    confidence,
    signals,
    warnings,
  }
}

/* ──────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────── */

export function normalizeCampaignType(
  campaign: Pick<
    DeepCampaignInsight,
    'platform' | 'objective' | 'channelType' | 'biddingStrategy' | 'adsets'
  >,
): NormalizedCampaignType {
  const platform = campaign.platform
  if (platform === 'Meta') return inferMetaCampaignType(campaign)
  if (platform === 'Google') return inferGoogleCampaignType(campaign)
  return {
    platform: 'unknown',
    campaignType: 'unknown',
    objective: null,
    optimizationGoal: null,
    channelType: null,
    confidence: 0,
    signals: [],
    warnings: ['unrecognized_platform'],
  }
}

export function getCampaignTypeKey(campaign: DeepCampaignInsight): CampaignTypeKey {
  return normalizeCampaignType(campaign).campaignType
}

/* ──────────────────────────────────────────────────────────
   Doctrine Fit Scoring

   Skorlama mantığı:
   - Failure signals tetiklenirse puan düşer
   - Required assets eksikse puan düşer
   - Severity rules tetiklenirse şiddete göre düşer
   - matchedPrinciples bulunduysa puan artar (max 100)
   ────────────────────────────────────────────────────────── */

const SIGNAL_PENALTY: Record<DoctrineSeverity, number> = {
  low: 5,
  medium: 12,
  high: 22,
  critical: 35,
}

interface SeverityRule {
  id?: string
  condition?: string
  severity?: DoctrineSeverity
}

interface RecommendationRule {
  id?: string
  if?: Record<string, unknown>
  action?: string
  priority?: string
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function evaluateSeverityRule(rule: SeverityRule, campaign: DeepCampaignInsight): boolean {
  if (!rule.condition || typeof rule.condition !== 'string') return false
  const c = rule.condition.toLowerCase()
  const m = campaign.metrics

  // Çok küçük bir DSL: sadece bilinen sinyalleri tanır.
  // Daha kapsamlı bir parser Faz 1+'e bırakıldı; bu fazda
  // en kritik failure pattern'lerini yakalar.
  if (/spend>500.*conversions=0.*clicks>50/.test(c)) {
    return m.spend > 500 && m.conversions === 0 && m.clicks > 50
  }
  if (/spend>500.*conversions=0/.test(c)) {
    return m.spend > 500 && m.conversions === 0
  }
  if (/spend>500.*landing_page_views<10/.test(c)) {
    return m.spend > 500 && m.clicks < 10
  }
  if (/spend>500.*leads=0/.test(c)) {
    return m.spend > 500 && m.conversions === 0
  }
  if (/spend>200.*conversations=0/.test(c)) {
    return m.spend > 200 && m.conversions === 0
  }
  if (/spend>200.*post_engagement<10/.test(c)) {
    return m.spend > 200 && m.clicks < 10
  }
  if (/ctr<0\.5/.test(c)) return m.ctr < 0.5
  if (/ctr<1\.5/.test(c)) return m.ctr < 1.5
  if (/cpc>15/.test(c)) return m.cpc > 15
  if (/cpc>1\.5/.test(c)) return m.cpc > 1.5
  if (/cpl>200/.test(c)) return m.cpc > 200 && m.conversions > 0 && m.spend / m.conversions > 200
  if (/roas<1.*spend>500/.test(c)) {
    return (m.roas ?? 0) < 1 && m.spend > 500
  }
  if (/frequency>5/.test(c)) {
    return (m.frequency ?? 0) > 5
  }
  if (/frequency>3/.test(c)) {
    return (m.frequency ?? 0) > 3
  }
  if (/audience_size<500000/.test(c) || /audience_size<1000000/.test(c)) {
    // Audience size bizim metrik şemamızda yok — false döner (eksik kabul).
    return false
  }
  if (/asset_strength=poor/.test(c)) {
    return false // metrik yok
  }
  if (/audience_signals_count=0/.test(c)) {
    return false // metrik yok
  }
  if (/learning_phase>14_days/.test(c)) {
    return false // metrik yok
  }
  if (/event_quality_score<5/.test(c)) {
    return false // metrik yok
  }
  if (/asset_count<3/.test(c)) {
    return false // metrik yok
  }
  if (/viewability<30/.test(c)) {
    return false // metrik yok
  }
  if (/view_rate<15/.test(c)) {
    return false // metrik yok
  }
  if (/impression_share_lost_budget>50/.test(c)) {
    return false // metrik yok (Google fetcher'a bağlı, opsiyonel)
  }
  return false
}

export function scoreDoctrineFit(
  campaign: DeepCampaignInsight,
  doctrine: PlatformDoctrine | null,
): DoctrineFitResult {
  if (!doctrine) {
    return {
      score: 50, // bilinmeyen — nötr başla
      matchedPrinciples: [],
      missingRequirements: [],
      failureSignals: [],
      recommendedChecks: ['no_doctrine_loaded_for_this_campaign_type'],
      severity: 'low',
    }
  }

  const matchedPrinciples: string[] = []
  const missingRequirements: string[] = []
  const failureSignals: string[] = []
  const recommendedChecks: string[] = []

  let score = 100

  // 1) Required assets: campaign şemasında doğrudan asset alanlarımız sınırlı,
  // bu yüzden bu fazda sadece "doctrine'da var" listesini AI promptuna geçirmek
  // için missingRequirements'a kopyalıyoruz (kullanıcıya hatırlatma).
  const required = asArray<string>(asObject(doctrine.required_assets).required)
  for (const r of required) {
    missingRequirements.push(`required_asset:${r}`)
  }

  // 2) Severity rules — gerçek metrik karşılığı olanlar değerlendirilir.
  const severityRules = asArray<SeverityRule>(doctrine.severity_rules)
  for (const rule of severityRules) {
    if (evaluateSeverityRule(rule, campaign)) {
      const sev = rule.severity ?? 'medium'
      const penalty = SIGNAL_PENALTY[sev] ?? SIGNAL_PENALTY.medium
      score -= penalty
      failureSignals.push(rule.id || rule.condition || 'unknown_severity_rule')
    }
  }

  // 3) Recommendation rules — sadece "if" eşleşmesi varsa "recommendedChecks"
  // listesine ekle (puan düşürmez; kullanıcıya öneri).
  const recRules = asArray<RecommendationRule>(doctrine.recommendation_rules)
  for (const r of recRules) {
    if (!r.action) continue
    // Bu fazda "if" parser'ı yok; tüm öneriler context olarak verilir.
    recommendedChecks.push(`${r.priority || 'medium'}: ${r.action}`)
  }

  // 4) matchedPrinciples — doctrine ile uyumlu olduğunu işaretleyen pozitif sinyaller.
  const benchmarks = asObject(asObject(doctrine.success_metrics).benchmarks)
  if (typeof benchmarks.ctr_min === 'number' && campaign.metrics.ctr >= benchmarks.ctr_min) {
    matchedPrinciples.push(`ctr_above_min(${benchmarks.ctr_min})`)
    score += 3
  }
  if (
    typeof benchmarks.frequency_max === 'number' &&
    (campaign.metrics.frequency ?? 0) <= benchmarks.frequency_max
  ) {
    matchedPrinciples.push('frequency_within_limit')
  }
  if (
    typeof benchmarks.roas_min === 'number' &&
    (campaign.metrics.roas ?? 0) >= benchmarks.roas_min
  ) {
    matchedPrinciples.push(`roas_above_min(${benchmarks.roas_min})`)
    score += 5
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, Math.round(score)))

  let severity: DoctrineSeverity = 'low'
  if (score < 30) severity = 'critical'
  else if (score < 50) severity = 'high'
  else if (score < 70) severity = 'medium'

  return {
    score,
    matchedPrinciples,
    missingRequirements,
    failureSignals,
    recommendedChecks: recommendedChecks.slice(0, 6),
    severity,
  }
}

/* ──────────────────────────────────────────────────────────
   AI prompt için kompakt summary (≤ ~500 char)
   ────────────────────────────────────────────────────────── */

export function buildCampaignTypeContext(
  campaign: DeepCampaignInsight,
  doctrine: PlatformDoctrine | null,
): CampaignTypeContext {
  const normalized = normalizeCampaignType(campaign)
  const fit = scoreDoctrineFit(campaign, doctrine)

  const parts: string[] = []
  parts.push(
    `[${normalized.campaignType} · conf=${normalized.confidence}] ${doctrine?.name || normalized.campaignType}`,
  )
  if (doctrine?.description) {
    parts.push(doctrine.description.slice(0, 140))
  }
  if (fit.failureSignals.length > 0) {
    parts.push(`⚠ failure_signals: ${fit.failureSignals.slice(0, 3).join(', ')}`)
  }
  if (fit.recommendedChecks.length > 0) {
    parts.push(`→ checks: ${fit.recommendedChecks.slice(0, 3).join(' | ')}`)
  }
  if (normalized.warnings.length > 0) {
    parts.push(`(! ${normalized.warnings.join(', ')})`)
  }

  const promptSummary = parts.join('\n').slice(0, 500)

  return {
    normalized,
    doctrineFit: fit,
    promptSummary,
  }
}
