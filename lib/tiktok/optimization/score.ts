/* ──────────────────────────────────────────────────────────
   TikTok Ads Optimizasyon — kampanya çekme + skorlama (Faz 1)

   Mevcut TikTok read altyapısını (getTikTokContext + tiktokApiRequest,
   /campaign/get/ + /report/integrated/get/) kullanır — entegrasyon koduna
   DOKUNULMAZ. Google rule engine'i (StandardMetrics tabanlı, platformdan
   bağımsız) yeniden kullanılır; çıktı ortak GoogleOptimizationCampaign
   şekline normalize edilir (UI kartları aynen tekrar kullanılabilsin).

   Sahte veri YOK: ROAS TikTok raporunda gelir değeri olmadığı için null
   bırakılır (uydurulmaz); aktivite yoksa skor düşer ama metrik uydurulmaz.
   ────────────────────────────────────────────────────────── */

import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'
import { runGoogleRuleEngine } from '@/lib/yoai/googleRuleEngine'
import type { GoogleProblemTagId, StandardMetrics, RiskLevel } from '@/lib/yoai/analysisTypes'
import type { ProblemTag, ProblemTagId } from '@/lib/meta/optimization/types'
import type { GoogleOptimizationCampaign } from '@/lib/google/optimization/types'

// Rule engine GoogleProblemTagId üretir; UI ortak Meta ProblemTagId kullanır.
const TAG_MAP: Record<GoogleProblemTagId, ProblemTagId> = {
  NO_DELIVERY: 'NO_DELIVERY',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  LOW_CTR: 'LOW_CTR',
  HIGH_CPC: 'HIGH_CPC',
  LOW_CONVERSIONS: 'HIGH_CPA',
  LOW_ROAS: 'LOW_ROAS',
  LOW_QUALITY_SCORE: 'QUALITY_BELOW_AVERAGE',
  IMPRESSION_SHARE_BUDGET_LOST: 'BUDGET_UNDERUTILIZED',
  IMPRESSION_SHARE_RANK_LOST: 'BUDGET_UNDERUTILIZED',
  AD_GROUP_IMBALANCE: 'ADSET_IMBALANCE',
  SINGLE_AD_GROUP_RISK: 'SINGLE_ADSET_RISK',
  LOW_OPT_SCORE: 'QUALITY_BELOW_AVERAGE',
}

function scoreFromProblems(tags: ProblemTag[]): number {
  let s = 100
  for (const t of tags) s -= t.severity === 'critical' ? 25 : t.severity === 'warning' ? 12 : 5
  return Math.max(0, Math.min(100, s))
}
function riskFromScore(score: number): RiskLevel {
  if (score >= 70) return 'low'
  if (score >= 45) return 'medium'
  if (score >= 25) return 'high'
  return 'critical'
}

interface TikTokCampaign {
  campaign_id: string
  campaign_name: string
  objective_type: string
  budget: number
  budget_mode: string
  operation_status: string
}
interface TikTokReportRow {
  dimensions: { campaign_id: string }
  metrics: { spend: string; impressions: string; clicks: string; ctr: string; cpc: string; conversion: string; reach: string }
}

function last7(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - 7 * 86_400_000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

async function resolveCurrency(ctx: Awaited<ReturnType<typeof getTikTokContext>>): Promise<string> {
  try {
    const info = await tiktokApiRequest<{ list: Array<{ currency?: string }> }>(
      '/advertiser/info/',
      ctx,
      { method: 'GET', params: { advertiser_ids: JSON.stringify([ctx.advertiserId]) } },
    )
    return info?.list?.[0]?.currency || 'TRY'
  } catch {
    return 'TRY'
  }
}

export async function fetchTiktokScoredCampaigns(): Promise<{ connected: boolean; campaigns: GoogleOptimizationCampaign[] }> {
  let ctx: Awaited<ReturnType<typeof getTikTokContext>>
  try {
    ctx = await getTikTokContext()
  } catch {
    return { connected: false, campaigns: [] }
  }

  const { from, to } = last7()

  const campaignData = await tiktokApiRequest<{ list: TikTokCampaign[] }>(
    '/campaign/get/',
    ctx,
    { params: { advertiser_id: ctx.advertiserId, filtering: JSON.stringify({ primary_status: 'STATUS_ENABLE' }), page_size: '200' } },
  )
  const list = campaignData?.list ?? []
  if (list.length === 0) return { connected: true, campaigns: [] }

  const currency = await resolveCurrency(ctx)

  const metricsMap = new Map<string, TikTokReportRow['metrics']>()
  try {
    const report = await tiktokApiRequest<{ list: TikTokReportRow[] }>(
      '/report/integrated/get/',
      ctx,
      {
        method: 'GET',
        params: {
          advertiser_id: ctx.advertiserId,
          report_type: 'BASIC',
          dimensions: JSON.stringify(['campaign_id']),
          metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'conversion', 'reach']),
          data_level: 'AUCTION_CAMPAIGN',
          start_date: from,
          end_date: to,
          page_size: '200',
        },
      },
    )
    for (const r of report?.list ?? []) metricsMap.set(r.dimensions.campaign_id, r.metrics)
  } catch {
    /* metriksiz devam — skor düşük çıkar, uydurma yapılmaz */
  }

  const campaigns: GoogleOptimizationCampaign[] = list.map((c) => {
    const m = metricsMap.get(c.campaign_id)
    const metrics: StandardMetrics = {
      spend: parseFloat(m?.spend || '0'),
      impressions: parseInt(m?.impressions || '0', 10),
      clicks: parseInt(m?.clicks || '0', 10),
      ctr: parseFloat(m?.ctr || '0'),
      cpc: parseFloat(m?.cpc || '0'),
      conversions: parseInt(m?.conversion || '0', 10),
      roas: null, // TikTok raporunda gelir değeri yok — uydurulmaz
      reach: parseInt(m?.reach || '0', 10),
    }

    const gTags = runGoogleRuleEngine({ metrics, adGroupCount: 0, adCount: 0, optimizationScore: null, dailyBudget: c.budget || null, currency })
    const problemTags: ProblemTag[] = gTags.map((g) => ({ id: TAG_MAP[g.id] ?? 'INSUFFICIENT_DATA', severity: g.severity, evidence: g.evidence }))
    const score = scoreFromProblems(problemTags)
    const isEnabled = c.operation_status === 'ENABLE' || c.operation_status === 'CAMPAIGN_STATUS_ENABLE'

    return {
      id: c.campaign_id,
      name: c.campaign_name,
      status: isEnabled ? 'ENABLED' : 'PAUSED',
      effectiveStatus: isEnabled ? 'ENABLED' : 'PAUSED',
      channelType: null,        // TikTok'ta kanal türü yok — ham enum sızdırmamak için null
      biddingStrategy: null,    // objective ham enum sızdırmamak için UI'da gösterilmez
      optimizationScore: null,
      currency,
      dailyBudget: c.budget || null,
      metrics,
      score,
      riskLevel: riskFromScore(score),
      problemTags,
      adsets: [],
    }
  })

  return { connected: true, campaigns }
}
