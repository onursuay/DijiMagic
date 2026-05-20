/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Brand Profile Pipeline (Faz 2)

   Kendi marka + rakip kaynaklarını tarar, deterministik iş zekasını
   üretir ve (opsiyonel) Claude marka sentezini ekler.

   NOT: Bu orchestrasyon, app/api/yoai/business-profile/route.ts içindeki
   runProfileScansAndIntelligence ile AYNI deterministik mantığı izler
   (aynı exported helper'lar). Route, kritik onboarding yolu olduğu için
   bilinçli olarak DEĞİŞTİRİLMEDİ; bu fonksiyon Inngest (manuel "Yenile" +
   cron) tarafından kullanılır ve ek olarak Claude sentezini çalıştırır.
   İleride iki yol tek helper'da birleştirilebilir.
   ────────────────────────────────────────────────────────── */

import {
  getProfileByUserId,
  listCompetitors,
  upsertProfile,
  insertSourceScans,
  deleteSourceScansForProfile,
  upsertIntelligence,
  type BusinessProfileRow,
  type BusinessSourceScanRow,
} from './businessProfileStore'
import { scanBusinessSources, type SourceScanInput, type SourceType } from './businessSourceScanner'
import { buildBusinessIntelligenceRow } from './businessIntelligenceBuilder'
import { synthesizeBrand } from './ai/brandSynthesis'

export interface BrandPipelineResult {
  ok: boolean
  reason?: string
  ownScans: number
  ownCompleted: number
  scan_status: BusinessProfileRow['scan_status']
  synthesized: boolean
}

export async function runBrandProfilePipeline(
  userId: string,
  opts?: { withSynthesis?: boolean },
): Promise<BrandPipelineResult> {
  const profile = await getProfileByUserId(userId)
  if (!profile || !profile.id) {
    return { ok: false, reason: 'no-profile', ownScans: 0, ownCompleted: 0, scan_status: 'failed', synthesized: false }
  }
  const competitors = await listCompetitors(userId)

  // Own brand source inputs
  const ownInputs: SourceScanInput[] = []
  const pushOwn = (type: SourceType, url: string | null | undefined) => {
    if (url) ownInputs.push({ source_type: type, source_url: url })
  }
  pushOwn('website', profile.website_url)
  pushOwn('instagram', profile.instagram_url)
  pushOwn('facebook', profile.facebook_url)
  pushOwn('linkedin', profile.linkedin_url)
  pushOwn('youtube', profile.youtube_url)
  pushOwn('tiktok', profile.tiktok_url)
  pushOwn('google_business', profile.google_business_profile_url)
  pushOwn('marketplace', profile.marketplace_url)

  // Competitor inputs
  const competitorScanRows: SourceScanInput[] = []
  const competitorScanIndex: { competitor_id: string }[] = []
  for (const comp of competitors) {
    const sources: { type: SourceType; url: string | null | undefined }[] = [
      { type: 'website', url: comp.website_url },
      { type: 'instagram', url: comp.instagram_url },
      { type: 'facebook', url: comp.facebook_url },
      { type: 'linkedin', url: comp.linkedin_url },
      { type: 'youtube', url: comp.youtube_url },
      { type: 'tiktok', url: comp.tiktok_url },
      { type: 'google_business', url: comp.google_business_url },
      { type: 'extra', url: comp.extra_url },
    ]
    for (const s of sources) {
      if (!s.url) continue
      competitorScanRows.push({ source_type: s.type, source_url: s.url })
      competitorScanIndex.push({ competitor_id: comp.id || '' })
    }
  }

  const [ownOutputs, competitorOutputs] = await Promise.all([
    scanBusinessSources(ownInputs),
    scanBusinessSources(competitorScanRows),
  ])

  const dbRows: Omit<BusinessSourceScanRow, 'id' | 'created_at'>[] = []
  ownOutputs.forEach((out) => {
    dbRows.push({
      user_id: profile.user_id, profile_id: profile.id!, competitor_id: null,
      source_owner_type: 'own_brand', source_type: out.source_type, source_url: out.source_url,
      scan_status: out.scan_status, raw_excerpt: out.raw_excerpt,
      extracted_title: out.extracted_title, extracted_description: out.extracted_description,
      extracted_services: out.extracted_services, extracted_products: out.extracted_products,
      extracted_keywords: out.extracted_keywords, extracted_audience: out.extracted_audience,
      extracted_locations: out.extracted_locations, extracted_ctas: out.extracted_ctas,
      extracted_brand_tone: out.extracted_brand_tone, extracted_offers: out.extracted_offers,
      extracted_social_proof: out.extracted_social_proof, confidence: out.confidence,
      error_message: out.error_message, scanned_at: out.scanned_at,
    })
  })
  competitorOutputs.forEach((out, idx) => {
    dbRows.push({
      user_id: profile.user_id, profile_id: profile.id!,
      competitor_id: competitorScanIndex[idx]?.competitor_id || null,
      source_owner_type: 'competitor', source_type: out.source_type, source_url: out.source_url,
      scan_status: out.scan_status, raw_excerpt: out.raw_excerpt,
      extracted_title: out.extracted_title, extracted_description: out.extracted_description,
      extracted_services: out.extracted_services, extracted_products: out.extracted_products,
      extracted_keywords: out.extracted_keywords, extracted_audience: out.extracted_audience,
      extracted_locations: out.extracted_locations, extracted_ctas: out.extracted_ctas,
      extracted_brand_tone: out.extracted_brand_tone, extracted_offers: out.extracted_offers,
      extracted_social_proof: out.extracted_social_proof, confidence: out.confidence,
      error_message: out.error_message, scanned_at: out.scanned_at,
    })
  })

  await deleteSourceScansForProfile(profile.id)
  await insertSourceScans(dbRows)

  // Deterministik iş zekası (korunur)
  const intelligence = buildBusinessIntelligenceRow(
    profile,
    competitors,
    dbRows.map((r, i) => ({ ...r, id: `scan_${i}` } as BusinessSourceScanRow)),
  )
  await upsertIntelligence({ ...intelligence, user_id: profile.user_id, profile_id: profile.id! })

  const ownCompleted = ownOutputs.filter((o) => o.scan_status === 'completed').length
  const competitorCompleted = competitorOutputs.filter((o) => o.scan_status === 'completed').length
  const totalScans = ownOutputs.length + competitorOutputs.length
  const completedScans = ownCompleted + competitorCompleted
  let scan_status: BusinessProfileRow['scan_status'] = 'completed'
  if (totalScans === 0 || completedScans === 0) scan_status = 'failed'
  else if (completedScans < totalScans) scan_status = 'partial'

  await upsertProfile({
    ...profile,
    scan_status,
    intelligence_status: 'completed',
    last_scan_completed_at: new Date().toISOString(),
  })

  // Claude marka sentezi (additive, soft-fail) — deterministik zeka korunur
  let synthesized = false
  if (opts?.withSynthesis) {
    const ownRows = dbRows
      .filter((r) => r.source_owner_type === 'own_brand')
      .map((r, i) => ({ ...r, id: `own_${i}` } as BusinessSourceScanRow))
    const res = await synthesizeBrand(profile, ownRows)
    synthesized = res.ok
  }

  return { ok: true, ownScans: ownOutputs.length, ownCompleted, scan_status, synthesized }
}
