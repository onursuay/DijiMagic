/* ──────────────────────────────────────────────────────────
   DijiAlgoritma — Platform Doctrine Store (Faz 1)

   dijimagic_platform_doctrine tablosunu okur; tablo/migration yok ise
   fallbackHardcodedDoctrine() ile minimal in-code mirror'a düşer.
   Bu sayede daily-run / adCreator migration uygulanmasa bile
   kırılmaz; sadece kapsam azalır.

   Önbellek: aynı request içinde tekrar tekrar fetch etmemek için
   modül seviyesinde 60 saniyelik bellek cache. (cron + UI ayrı
   process'lerde bu cache izole çalışır.)
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'
import type { CampaignTypeKey } from './campaignTypeIntelligence'
import type { DeepCampaignInsight } from './analysisTypes'
import { normalizeCampaignType } from './campaignTypeIntelligence'

const TABLE_MIGRATION_HINT =
  'supabase/migrations/20260510004000_create_dijimagic_platform_doctrine.sql'

export interface PlatformDoctrine {
  id?: string
  platform: 'meta' | 'google'
  campaign_type: string
  objective: string | null
  optimization_goal: string | null
  channel_type: string | null
  name: string
  description: string | null
  success_metrics: Record<string, unknown>
  failure_signals: Record<string, unknown>
  required_assets: Record<string, unknown>
  targeting_principles: Record<string, unknown>
  bidding_principles: Record<string, unknown>
  creative_principles: Record<string, unknown>
  policy_notes: Record<string, unknown>
  recommendation_rules: unknown[]
  severity_rules: unknown[]
  is_active?: boolean
  version?: number
}

let cache: { at: number; map: Record<string, PlatformDoctrine> } | null = null
let warnedTableMissing = false
const CACHE_TTL_MS = 60_000

function isTableMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || /relation .* does not exist/i.test(error.message || '')
}

function indexByCampaignType(rows: PlatformDoctrine[]): Record<string, PlatformDoctrine> {
  const map: Record<string, PlatformDoctrine> = {}
  for (const r of rows) {
    if (r.is_active === false) continue
    map[r.campaign_type] = r
  }
  return map
}

export async function listActiveDoctrine(): Promise<PlatformDoctrine[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return Object.values(cache.map)
  }

  if (!supabase) {
    return Object.values(fallbackHardcodedDoctrine())
  }

  const { data, error } = await supabase
    .from('dijimagic_platform_doctrine')
    .select('*')
    .eq('is_active', true)

  if (error) {
    if (isTableMissingError(error)) {
      if (!warnedTableMissing) {
        console.warn(
          `[PlatformDoctrineStore] dijimagic_platform_doctrine tablosu yok — fallback hardcoded doctrine kullanılacak. ` +
            `Migration uygulayın: ${TABLE_MIGRATION_HINT}`,
        )
        warnedTableMissing = true
      }
      const fb = fallbackHardcodedDoctrine()
      cache = { at: Date.now(), map: fb }
      return Object.values(fb)
    }
    console.error('[PlatformDoctrineStore] list error:', error)
    return Object.values(fallbackHardcodedDoctrine())
  }

  const rows = (data || []) as PlatformDoctrine[]
  const map = indexByCampaignType(rows.length > 0 ? rows : Object.values(fallbackHardcodedDoctrine()))
  cache = { at: Date.now(), map }
  return Object.values(map)
}

export async function getDoctrineMap(): Promise<Record<string, PlatformDoctrine>> {
  await listActiveDoctrine() // cache'i doldur
  return cache?.map || fallbackHardcodedDoctrine()
}

export async function getDoctrineByCampaignType(
  platform: 'meta' | 'google',
  campaignType: string,
): Promise<PlatformDoctrine | null> {
  const map = await getDoctrineMap()
  const row = map[campaignType]
  if (row && row.platform === platform) return row
  return null
}

export async function getDoctrineForCampaign(
  campaign: Pick<
    DeepCampaignInsight,
    'platform' | 'objective' | 'channelType' | 'biddingStrategy' | 'adsets'
  >,
): Promise<{ campaignTypeKey: CampaignTypeKey; doctrine: PlatformDoctrine | null }> {
  const normalized = normalizeCampaignType(campaign)
  const map = await getDoctrineMap()
  const row = map[normalized.campaignType] || null
  return { campaignTypeKey: normalized.campaignType, doctrine: row }
}

/** Test/debug için cache'i sıfırla. */
export function clearDoctrineCache(): void {
  cache = null
}

/* ──────────────────────────────────────────────────────────
   Fallback Hardcoded Doctrine

   Migration uygulanmadıysa veya DB erişimi başarısızsa bu mirror
   devreye girer. Migration seed'inin küçük bir alt kümesidir:
   her campaign_type için minimum required field'lar dolu.

   Kapsamlı kurallar DB'den gelir; bu fallback sadece daily-run /
   adCreator'ın tip-aware çalışmasını sağlamak için iskelet sunar.
   ────────────────────────────────────────────────────────── */

export function fallbackHardcodedDoctrine(): Record<string, PlatformDoctrine> {
  const empty = {
    success_metrics: {},
    failure_signals: {},
    required_assets: {},
    targeting_principles: {},
    bidding_principles: {},
    creative_principles: {},
    policy_notes: {},
    recommendation_rules: [] as unknown[],
    severity_rules: [] as unknown[],
    is_active: true,
    version: 1,
  }

  return {
    meta_traffic: {
      ...empty,
      platform: 'meta',
      campaign_type: 'meta_traffic',
      objective: 'OUTCOME_TRAFFIC',
      optimization_goal: 'LANDING_PAGE_VIEWS',
      channel_type: null,
      name: 'Meta Trafik',
      description:
        'Web sitesine veya uygulamaya nitelikli trafik çekmek. CTR + LP view + CPC kritik.',
      success_metrics: {
        primary: ['link_clicks', 'landing_page_views', 'ctr', 'cpc'],
        benchmarks: { ctr_min: 0.8, ctr_good: 1.5 },
      },
      severity_rules: [
        { id: 'ctr_collapse', condition: 'ctr<0.5', severity: 'high' },
        { id: 'cpc_spike', condition: 'cpc>15', severity: 'medium' },
      ],
    },
    meta_engagement: {
      ...empty,
      platform: 'meta',
      campaign_type: 'meta_engagement',
      objective: 'OUTCOME_ENGAGEMENT',
      optimization_goal: 'POST_ENGAGEMENT',
      channel_type: null,
      name: 'Meta Etkileşim',
      description: 'Etkileşim, beğeni, yorum, paylaşım. Frekans 3 üstü creative fatigue işareti.',
      success_metrics: {
        primary: ['post_engagement', 'reactions', 'comments', 'shares'],
        benchmarks: { engagement_rate_min: 1.5, frequency_max: 3 },
      },
      severity_rules: [
        { id: 'frequency_high', condition: 'frequency>5', severity: 'high' },
      ],
    },
    meta_lead: {
      ...empty,
      platform: 'meta',
      campaign_type: 'meta_lead',
      objective: 'OUTCOME_LEADS',
      optimization_goal: 'LEAD_GENERATION',
      channel_type: null,
      name: 'Meta Lead',
      description: 'Lead form üzerinden iletişim toplamak. CPL ve form completion rate kritik.',
      success_metrics: {
        primary: ['leads', 'cpl', 'form_completion_rate'],
        benchmarks: { cpl_max_try: 80 },
      },
      severity_rules: [{ id: 'no_leads', condition: 'spend>500 AND leads=0', severity: 'critical' }],
    },
    meta_message: {
      ...empty,
      platform: 'meta',
      campaign_type: 'meta_message',
      objective: 'OUTCOME_ENGAGEMENT',
      optimization_goal: 'CONVERSATIONS',
      channel_type: null,
      name: 'Meta Mesaj',
      description: 'WhatsApp / Messenger / IG DM üzerinden konuşma başlatmak.',
      success_metrics: {
        primary: ['messaging_conversations_started', 'cost_per_messaging_conversation', 'reply_rate'],
      },
      severity_rules: [
        { id: 'no_conv', condition: 'spend>200 AND conversations=0', severity: 'critical' },
      ],
    },
    meta_sales: {
      ...empty,
      platform: 'meta',
      campaign_type: 'meta_sales',
      objective: 'OUTCOME_SALES',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      channel_type: null,
      name: 'Meta Satış',
      description: 'Pixel/CAPI ile ölçülen satış üretmek. ROAS + dönüşüm + event quality kritik.',
      success_metrics: {
        primary: ['conversions', 'roas', 'cpa', 'purchase_value'],
        benchmarks: { roas_min: 2 },
      },
      severity_rules: [
        {
          id: 'pixel_misfire',
          condition: 'spend>500 AND conversions=0 AND clicks>50',
          severity: 'critical',
        },
        { id: 'low_roas', condition: 'roas<1 AND spend>500', severity: 'high' },
      ],
    },
    meta_awareness: {
      ...empty,
      platform: 'meta',
      campaign_type: 'meta_awareness',
      objective: 'OUTCOME_AWARENESS',
      optimization_goal: 'REACH',
      channel_type: null,
      name: 'Meta Bilinirlik',
      description: 'Marka bilinirliğini geniş kitleye ulaştırmak. Reach + frequency + brand lift.',
      success_metrics: {
        primary: ['reach', 'impressions', 'frequency'],
        benchmarks: { frequency_max: 4 },
      },
      severity_rules: [
        { id: 'creative_fatigue', condition: 'frequency>5', severity: 'high' },
      ],
    },
    google_search: {
      ...empty,
      platform: 'google',
      campaign_type: 'google_search',
      objective: null,
      optimization_goal: 'MAXIMIZE_CONVERSIONS',
      channel_type: 'SEARCH',
      name: 'Google Arama',
      description: 'Yüksek niyetli arama trafiği. CTR + QS + conversion rate kritik.',
      success_metrics: {
        primary: ['clicks', 'ctr', 'conversions', 'conversion_rate', 'quality_score'],
        benchmarks: { ctr_min: 2 },
      },
      severity_rules: [
        { id: 'no_conv_search', condition: 'spend>500 AND conversions=0', severity: 'critical' },
        { id: 'low_ctr_search', condition: 'ctr<1.5', severity: 'high' },
      ],
    },
    google_display: {
      ...empty,
      platform: 'google',
      campaign_type: 'google_display',
      objective: null,
      optimization_goal: 'MAXIMIZE_CLICKS',
      channel_type: 'DISPLAY',
      name: 'Google Display',
      description: 'Display Network görsel reklamlar. Asset diversity + audience signal kritik.',
      success_metrics: {
        primary: ['viewable_impressions', 'ctr', 'cpc', 'cpm', 'assisted_conversions'],
        benchmarks: { ctr_min: 0.3 },
      },
      severity_rules: [],
    },
    google_video: {
      ...empty,
      platform: 'google',
      campaign_type: 'google_video',
      objective: null,
      optimization_goal: 'TARGET_CPV',
      channel_type: 'VIDEO',
      name: 'Google Video (YouTube)',
      description: 'Video reklamlar. View rate + CPV + ilk 5 saniye kritik.',
      success_metrics: {
        primary: ['view_rate', 'cpv', 'video_views', 'engagement'],
        benchmarks: { view_rate_min: 25 },
      },
      severity_rules: [],
    },
    google_pmax: {
      ...empty,
      platform: 'google',
      campaign_type: 'google_pmax',
      objective: null,
      optimization_goal: 'MAXIMIZE_CONVERSIONS',
      channel_type: 'PERFORMANCE_MAX',
      name: 'Google Performance Max',
      description:
        'Tüm Google envanteri otomasyonla. Asset variety + audience signals + conversion tracking kritik.',
      success_metrics: {
        primary: ['conversions', 'conversion_value', 'roas', 'asset_strength'],
        benchmarks: { roas_min: 2 },
      },
      severity_rules: [],
    },
  }
}
