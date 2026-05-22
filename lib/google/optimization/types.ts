/* Google Ads Optimizasyon — UI tipleri (Faz 1).
   googleDeepFetcher çıktısının Optimizasyon sayfası için sadeleştirilmiş şekli.
   ProblemTag/Recommendation Meta tipleriyle ortak (googleDeepFetcher zaten
   Meta-format ProblemTag üretir). */

import type { StandardMetrics, RiskLevel } from '@/lib/yoai/analysisTypes'
import type { ProblemTag } from '@/lib/meta/optimization/types'
import type { GateBreakdown } from './gates'

export interface GoogleOptimizationAdset {
  id: string
  name: string
  status: string
  dailyBudget: number | null
  metrics: StandardMetrics
}

export interface GoogleOptimizationCampaign {
  id: string
  name: string
  status: string
  effectiveStatus: string
  channelType: string | null
  biddingStrategy: string | null
  optimizationScore: number | null
  currency: string
  dailyBudget: number | null
  metrics: StandardMetrics
  score: number
  riskLevel: RiskLevel
  /** 4 kapılı skor kırılımı (Teslimat/Verim/Kalite/Doygunluk) — Meta ile aynı model. */
  gates?: GateBreakdown
  problemTags: ProblemTag[]
  adsets: GoogleOptimizationAdset[]
}
