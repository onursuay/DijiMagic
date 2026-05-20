/* ──────────────────────────────────────────────────────────
   YoAlgoritma — ad_spec → FullAdProposal köprüsü (Faz 2)

   Geliştirme Kartı "Onayla" dendiğinde, ai_ad_improvements satırındaki
   ad_spec'i mevcut AdCreationWizard'ın beklediği FullAdProposal'a çevirir.
   Böylece kullanıcı MEVCUT önizleme→yayınlama akışıyla canlıya alır
   (Meta/Google entegrasyonuna dokunulmaz — mevcut create yolu kullanılır).
   ────────────────────────────────────────────────────────── */

import type { FullAdProposal } from '@/lib/yoai/adCreator'
import type { Platform } from '@/lib/yoai/analysisTypes'
import type { AdImprovementRow } from './improvementStore'
import type { AdSpec } from './types'

function buildTargetingDescription(t: AdSpec['targeting'] | undefined): string {
  if (!t) return '—'
  const parts: string[] = []
  if (t.locations?.length) parts.push(t.locations.join(', '))
  if (t.demographics) {
    const d = t.demographics
    parts.push(`${d.age_min}-${d.age_max} yaş`)
    if (d.genders?.length && !d.genders.includes('all')) {
      parts.push(d.genders.map((g) => (g === 'male' ? 'Erkek' : g === 'female' ? 'Kadın' : 'Tümü')).join('/'))
    }
  }
  if (t.interests?.length) parts.push(t.interests.slice(0, 3).join(', '))
  return parts.join(' · ') || '—'
}

export function improvementToProposal(row: AdImprovementRow): FullAdProposal | null {
  const payload = row.improvement_payload as {
    ad_spec?: AdSpec | null
    reasoning?: string
    competitor_comparison?: string | null
    confidence?: number
  }
  const spec = payload?.ad_spec
  if (!spec) return null

  const platform: Platform = spec.platform === 'google' ? 'Google' : 'Meta'
  const headlines = spec.creative?.headlines ?? []
  const descriptions = spec.creative?.descriptions ?? []

  return {
    id: `imp_${row.id}`,
    platform,
    sourceCampaignId: row.source_campaign_id ?? undefined,
    sourceCampaignName: row.source_campaign_name ?? undefined,
    proposalType: 'optimization',
    campaignName: row.source_campaign_name || spec.campaign_type || 'Kampanya',
    campaignObjective: spec.campaign_type || '',
    objectiveLabel: spec.campaign_type || '',
    dailyBudget: spec.budget?.daily ?? 0,
    adsetName: row.source_ad_name ? `${row.source_ad_name} — iyileştirme` : 'Reklam Seti',
    targetingDescription: buildTargetingDescription(spec.targeting),
    optimizationGoal: spec.conversion_goal || undefined,
    adName: row.source_ad_name ? `${row.source_ad_name} v2` : 'Yeni Reklam',
    primaryText: spec.creative?.primary_text || descriptions[0] || '',
    headline: headlines[0] || '',
    description: descriptions[0] || '',
    callToAction: spec.cta || '',
    headlines: headlines.length ? headlines : undefined,
    descriptions: descriptions.length ? descriptions : undefined,
    reasoning: payload?.reasoning || '',
    competitorInsight: payload?.competitor_comparison || '',
    expectedPerformance: '',
    confidence: row.confidence ?? payload?.confidence ?? 0,
    impactLevel: 'high',
    isNewObjective: false,
    analyzedParameters: [],
    suggestedChanges: [],
  }
}
