/* ──────────────────────────────────────────────────────────
   DijiAlgoritma — Brand Intelligence Claude Sentezi (Faz 2)

   Mevcut DETERMİNİSTİK iş zekası (buildBusinessIntelligenceRow)
   korunur. Bu modül, kullanıcının kendi markasının taranmış
   kaynaklarından (website + Instagram + Facebook …) Claude ile
   ZENGİNLEŞTİRİLMİŞ bir marka sentezi üretip user_business_intelligence'ın
   ai_synthesis kolonuna yazar.

   Soft-fail: Anthropic hazır değilse veya çağrı başarısızsa sessizce
   geçer — deterministik zeka aynen kalır (regresyon yok).
   ────────────────────────────────────────────────────────── */

import { getAnthropicClient, getAiEngineModel, isAnthropicReady } from '@/lib/anthropic/client'
import { supabase } from '@/lib/supabase/client'
import type { BusinessProfileRow, BusinessSourceScanRow } from '@/lib/dijimagic/businessProfileStore'

const SYNTHESIS_MAX_TOKENS = 2000

export interface BrandSynthesis {
  brand_voice: string | null
  value_proposition: string | null
  messaging_pillars: string[]
  differentiators: string[]
  refined_company_summary: string | null
  suggested_keywords: string[]
  tone_guidance: string | null
}

const SYSTEM = `Sen bir marka strateji uzmanısın. Sana bir işletmenin KENDİ dijital kaynaklarından (website, Instagram, Facebook) çıkarılmış sinyaller veriliyor. Görevin bu sinyalleri sentezleyip markanın sesini, değer önerisini ve mesaj sütunlarını çıkarmak.

SADECE şu JSON şemasına uyan tek bir JSON nesnesi döndür (markdown YOK, açıklama YOK):
{
  "brand_voice": "Markanın sesi/tonu — 1-2 cümle (Türkçe)",
  "value_proposition": "Tek cümlelik değer önerisi",
  "messaging_pillars": ["3-5 ana mesaj sütunu"],
  "differentiators": ["rakiplerden farklılaştıran 2-4 unsur"],
  "refined_company_summary": "Zenginleştirilmiş, reklam metinlerinde kullanılabilir kısa firma özeti",
  "suggested_keywords": ["reklam için 5-10 anahtar tema"],
  "tone_guidance": "Reklam kreatifleri için ton rehberi (1-2 cümle)"
}

Kurallar: Yalnızca verilen sinyallere dayan, uydurma. Bilgi yetersizse ilgili alanı null veya boş dizi yap. Tüm metinler Türkçe.`

function buildUserMessage(profile: BusinessProfileRow, ownScans: BusinessSourceScanRow[]): string {
  const completed = ownScans.filter((s) => s.scan_status === 'completed')
  const lines: string[] = []
  lines.push(`# İşletme: ${profile.company_name ?? '—'}`)
  if (profile.business_description) lines.push(`Beyan: ${profile.business_description}`)
  if (profile.target_audience) lines.push(`Hedef kitle: ${profile.target_audience}`)
  if (Array.isArray(profile.products_or_services) && profile.products_or_services.length) {
    lines.push(`Ürün/Hizmet: ${profile.products_or_services.join(', ')}`)
  }
  lines.push('')
  lines.push('## Taranan kendi kaynakların sinyalleri')
  if (completed.length === 0) {
    lines.push('(Tamamlanmış kaynak taraması yok)')
  }
  for (const s of completed) {
    lines.push(`### ${s.source_type} (${s.source_url ?? ''})`)
    if (s.extracted_title) lines.push(`Başlık: ${s.extracted_title}`)
    if (s.extracted_description) lines.push(`Açıklama: ${s.extracted_description}`)
    if (s.extracted_services?.length) lines.push(`Hizmetler: ${s.extracted_services.join(', ')}`)
    if (s.extracted_offers?.length) lines.push(`Teklifler: ${s.extracted_offers.join(', ')}`)
    if (s.extracted_brand_tone) lines.push(`Ton: ${s.extracted_brand_tone}`)
    if (s.extracted_ctas?.length) lines.push(`CTA'lar: ${s.extracted_ctas.join(', ')}`)
    if (s.raw_excerpt) lines.push(`Alıntı: ${s.raw_excerpt.slice(0, 600)}`)
    lines.push('')
  }
  lines.push('Bu sinyalleri sentezle ve yukarıdaki JSON şemasına uy.')
  return lines.join('\n')
}

function parseSynthesis(text: string | null): BrandSynthesis | null {
  if (!text) return null
  const tryParse = (s: string): BrandSynthesis | null => {
    try {
      const o = JSON.parse(s) as Record<string, unknown>
      const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim()) : [])
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
      return {
        brand_voice: str(o.brand_voice),
        value_proposition: str(o.value_proposition),
        messaging_pillars: arr(o.messaging_pillars),
        differentiators: arr(o.differentiators),
        refined_company_summary: str(o.refined_company_summary),
        suggested_keywords: arr(o.suggested_keywords),
        tone_guidance: str(o.tone_guidance),
      }
    } catch { return null }
  }
  const direct = tryParse(text)
  if (direct) return direct
  const fb = text.indexOf('{'); const lb = text.lastIndexOf('}')
  if (fb >= 0 && lb > fb) return tryParse(text.slice(fb, lb + 1))
  return null
}

/**
 * Kendi marka kaynaklarından Claude sentezi üretir ve
 * user_business_intelligence.ai_synthesis'a yazar. Soft-fail.
 */
export async function synthesizeBrand(
  profile: BusinessProfileRow,
  ownScans: BusinessSourceScanRow[],
): Promise<{ ok: boolean; reason?: string }> {
  if (!profile.id || !profile.user_id) return { ok: false, reason: 'no-profile' }
  if (!isAnthropicReady()) return { ok: false, reason: 'anthropic-not-ready' }
  if (!supabase) return { ok: false, reason: 'no-db' }
  if (ownScans.filter((s) => s.scan_status === 'completed').length === 0) {
    return { ok: false, reason: 'no-completed-scans' }
  }

  try {
    const client = getAnthropicClient()
    const model = getAiEngineModel()
    const res = await client.messages.create({
      model,
      max_tokens: SYNTHESIS_MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildUserMessage(profile, ownScans) }],
    })
    let text: string | null = null
    for (const block of res.content) {
      if (block.type === 'text') text = block.text
    }
    const synthesis = parseSynthesis(text)
    if (!synthesis) return { ok: false, reason: 'parse-failed' }

    const { error } = await supabase
      .from('user_business_intelligence')
      .update({
        ai_synthesis: synthesis,
        ai_synthesis_model: model,
        ai_synthesis_at: new Date().toISOString(),
      })
      .eq('user_id', profile.user_id)
    if (error) {
      console.error('[BrandSynthesis] update error:', error)
      return { ok: false, reason: 'db-update-failed' }
    }
    return { ok: true }
  } catch (e) {
    console.warn('[BrandSynthesis] soft-fail:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'exception' }
  }
}
