/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Synthesis Engine v2 (Faz 3)

   Synthesis Engine, AI proposal generator'a verilmeden önce
   üç bilgi kaynağını tek normalize bir paket halinde birleştirir:

   1) Kampanya performansı + diagnosis (deepFetcher / metrics)
   2) Platform Doctrine (Faz 1: yoai_platform_doctrine)
   3) Rakip içgörüleri (Faz 2: yoai_competitor_insights)

   Bu fazda hiçbir LLM çağrısı yapılmaz; tüm birleştirme
   deterministiktir. AI proposal output schema KIRILMAZ —
   synthesis context yalnızca prompt'a additive bir blok ekler.
   ────────────────────────────────────────────────────────── */

import type {
  DeepCampaignInsight,
  Platform,
  RiskLevel,
} from './analysisTypes'
import type { PlatformDoctrine } from './platformDoctrineStore'
import type {
  CampaignTypeKey,
  DoctrineFitResult,
  NormalizedCampaignType,
} from './campaignTypeIntelligence'
import type { CompetitorInsightRow } from './competitorInsightStore'

/* ── Kaynak meta ── */

/**
 * Bir synthesis package'ının hangi kaynaktan beslendiğini açıklar.
 * Audit ve debug için kullanılır.
 */
export interface CampaignSynthesisSource {
  /** Performans/diagnosis için ham snapshot kaynağı (ör. 'deepCampaignInsight'). */
  campaign: 'deepCampaignInsight'
  /** Doctrine kaynağı: DB'den okundu, fallback'e düştü, ya da hiç yok. */
  doctrine: 'db' | 'fallback' | 'missing'
  /** Competitor kaynağı: DB'den okundu mu? */
  competitor: 'db' | 'missing'
  /** Doctrine kaynağı için opsiyonel detay (ör. version/timestamp). */
  doctrineDetail?: string | null
  /** Competitor kaynağı için opsiyonel detay (ör. generated_at). */
  competitorDetail?: string | null
}

/* ── Atomic risk/opportunity tipleri ── */

export interface SynthesisRisk {
  id: string
  /** Hangi kaynaktan tetiklendi? */
  origin: 'diagnosis' | 'doctrine' | 'competitor' | 'composite'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
}

export interface SynthesisOpportunity {
  id: string
  origin: 'diagnosis' | 'doctrine' | 'competitor' | 'composite'
  message: string
}

/**
 * Proposal generator'a verilen "yapma" kısıtları — yanlış objective
 * önerme, yanlış format önerme vs.
 */
export interface SynthesisRecommendationConstraint {
  id: string
  message: string
}

export type SynthesisConfidenceLevel = 'low' | 'medium' | 'high'

export interface SynthesisConfidence {
  /** 0-100 toplam güven. */
  score: number
  level: SynthesisConfidenceLevel
  /** Skoru oluşturan kısa gerekçeler. */
  reasons: string[]
}

/* ── Engine input ── */

export interface SynthesisInput {
  campaign: DeepCampaignInsight
  doctrine: PlatformDoctrine | null
  /** Faz 1 normalize sonucu. Engine yoksa kendisi normalize eder. */
  normalizedCampaignType?: NormalizedCampaignType
  /** Faz 1 doctrine fit sonucu. Engine yoksa kendisi hesaplar. */
  doctrineFit?: DoctrineFitResult
  /** Faz 2 kalıcı rakip içgörüsü. Yoksa null. */
  competitorInsight: CompetitorInsightRow | null
  /** Üst seviye opsiyonel meta (ör. doctrineSource detayı). */
  meta?: {
    doctrineSource?: 'db' | 'fallback' | 'missing'
    competitorDetail?: string | null
  }
}

/* ── Snapshot alt tipler ── */

export interface PerformanceSnapshot {
  spend: number
  impressions: number
  clicks: number
  /** % cinsinden (örn. 1.5 = %1.5) — adCreator currentParams ile uyumlu. */
  ctr: number
  cpc: number
  conversions: number
  cpm: number
  roas: number | null
  frequency: number | null
}

export interface DoctrineSnapshot {
  /** Doctrine var mı? */
  available: boolean
  name: string | null
  description: string | null
  successMetrics: string[]
  failureSignals: string[]
  requiredAssets: string[]
  biddingPrinciples: string[]
  creativePrinciples: string[]
  targetingPrinciples: string[]
  policyNotes: string[]
  /** Doctrine fit skoru (0-100); doctrine yoksa null. */
  fitScore: number | null
  fitSeverity: 'low' | 'medium' | 'high' | 'critical' | null
  matchedPrinciples: string[]
  missingRequirements: string[]
  recommendedChecks: string[]
}

export interface DiagnosisSnapshot {
  rootCauses: string[]
  problemTags: string[]
  riskLevel: RiskLevel
  opportunities: string[]
  recommendedActions: string[]
}

export interface CompetitorSnapshot {
  available: boolean
  adsCount: number
  topHooks: string[]
  topCtas: string[]
  topValueProps: string[]
  commonPhrases: string[]
  offerPatterns: string[]
  creativePatterns: string[]
  competitorSummary: string
  /** 0-100; rakip içgörüsü yoksa 0. */
  confidence: number
}

export interface SynthesisSummary {
  /** Tek satırlık ana problem (TR). */
  mainProblem: string
  /** Tek satırlık ana fırsat (TR). */
  mainOpportunity: string
  /** Önerilecek mesaj/ton açısı. */
  recommendedAngle: string
  /** Kreatif yön. */
  creativeDirection: string
  /** Hedefleme yön. */
  targetingDirection: string
  /** Bidding yön. */
  biddingDirection: string
  /**
   * Synthesis Engine'in mutlak kuralı: kampanya türü değişmez.
   * Bu alan her zaman true; AI proposal kampanya objective'ini
   * değiştirmek için kullanılamaz.
   */
  mustKeepCampaignType: true
  /**
   * Bu kampanya için açıkça yasak hareketler (ör. "engagement objective'e geçme").
   */
  forbiddenMoves: string[]
  /**
   * AI proposal generator'a verilecek kısa, prompt-safe brief
   * (≈ 500-800 char). Tek campaign için.
   */
  proposalBrief: string
  confidence: SynthesisConfidence
  /** Karar verirken kullanılan kanıtların kısa listesi. */
  evidence: string[]
}

/* ── Çıktı paketi ── */

export interface CampaignSynthesisPackage {
  /** Hızlı index için. */
  campaignId: string
  platform: Platform
  /** Faz 1 normalize sonucundan campaign type. */
  campaignType: CampaignTypeKey | string
  campaignName: string
  /** İsteğe bağlı; generator için. */
  sourceCampaignStatus?: string

  performanceSnapshot: PerformanceSnapshot
  doctrine: DoctrineSnapshot
  diagnosis: DiagnosisSnapshot
  competitor: CompetitorSnapshot
  synthesis: SynthesisSummary
  source: CampaignSynthesisSource

  /** Faz 1 normalize çıktısı, debug için. */
  normalized: NormalizedCampaignType
  /** Engine içinden çıkan structured riskler. */
  risks: SynthesisRisk[]
  /** Engine içinden çıkan structured fırsatlar. */
  opportunities: SynthesisOpportunity[]
  /** AI generator için constraint listesi (yanlış öneri yapma'nın atomic hali). */
  constraints: SynthesisRecommendationConstraint[]
  /** Synthesis paketi build zamanı (ISO). */
  generatedAt: string
}

/* ── Engine sonucu ── */

export interface SynthesisEngineResult {
  packages: CampaignSynthesisPackage[]
  /** packageMap[campaignId] = paket — adCreator için hızlı lookup. */
  packageMap: Record<string, CampaignSynthesisPackage>
  /** Engine seviyesinde karşılaşılan non-fatal hataların kısa listesi. */
  warnings: string[]
  /** Toplam paket sayısı. */
  count: number
  /** Engine build zamanı (ISO). */
  generatedAt: string
}
