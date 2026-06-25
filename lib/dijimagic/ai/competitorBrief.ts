/* ──────────────────────────────────────────────────────────
   DijiAlgoritma AI Engine — Competitor Ads Brief (pure builder)

   dijimagic_competitor_insights (deterministik özet) + dijimagic_competitor_ads
   (somut örnek reklamlar) verisini Claude payload'ına gidecek
   "## Rakip Reklam Analizi" markdown bloğuna çevirir.

   Üç ayaklı analizin 3. ayağı (rakip analizi). Pure builder —
   supabase bağımlılığı yok; scanUser.loadCompetitorContext bunu
   besler, testler doğrudan import edebilir.
   ────────────────────────────────────────────────────────── */

export interface CompetitorBriefInsight {
  ads_count: number
  active_advertisers_count: number
  top_hooks: { token: string; count: number }[]
  top_ctas: { cta: string; count: number }[]
  top_value_props: { token: string; count: number }[]
  offer_patterns: { token: string; count: number }[]
  common_phrases: string[]
  competitor_summary: string | null
  confidence: number
  generated_at: string | null
}

export interface CompetitorBriefSampleAd {
  advertiser_name: string | null
  ad_title: string | null
  ad_body: string | null
  call_to_action: string | null
  is_active: boolean
  /** Google transparency gibi metin döndürmeyen kaynaklarda false. */
  text_available?: boolean
}

export interface CompetitorBriefInput {
  platform: 'Meta' | 'Google'
  insight: CompetitorBriefInsight | null
  sampleAds: CompetitorBriefSampleAd[]
}

const MAX_SAMPLES = 6
const MAX_BODY = 200

function cap(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

/**
 * Pure builder — rakip insight + örnek reklamlar → markdown blok | null.
 * Veri yoksa (insight yok ve örnek yok) null döner; payload'a hiç eklenmez.
 */
export function buildCompetitorAdsBrief(input: CompetitorBriefInput): string | null {
  const { insight, sampleAds, platform } = input
  const hasInsight = !!insight && insight.ads_count > 0
  const hasSamples = sampleAds.length > 0
  if (!hasInsight && !hasSamples) return null

  const lines: string[] = []
  lines.push(`## Rakip Reklam Analizi (${platform} — otomatik tarama)`)
  lines.push(
    'Aşağıdaki veriler rakiplerin AKTİF reklamlarından otomatik tarandı. Kullanıcı vs rakip ' +
      'kıyaslaması yap; rakiplerin kullandığı ama kullanıcıda eksik olan açı/teklif/CTA boşluklarını ' +
      'fırsat olarak işaretle. Rakip taktiğini körü körüne kopyalama — kullanıcının beyan ettiği ' +
      'konumlandırmaya ve yasaklı iddialara uygun öner.',
  )

  if (hasInsight && insight) {
    lines.push('')
    lines.push(
      `### Özet (kayıt: ${insight.generated_at?.slice(0, 10) ?? '—'}, güven: ${insight.confidence}/100)`,
    )
    lines.push(`- Analiz edilen reklam: ${insight.ads_count}, farklı reklamveren: ${insight.active_advertisers_count}`)
    if (insight.top_hooks.length) {
      lines.push(`- Sık hook'lar: ${insight.top_hooks.slice(0, 6).map((h) => `${h.token}(${h.count})`).join(', ')}`)
    }
    if (insight.top_ctas.length) {
      lines.push(`- Sık CTA'lar: ${insight.top_ctas.slice(0, 6).map((c) => `${c.cta}(${c.count})`).join(', ')}`)
    }
    if (insight.top_value_props.length) {
      lines.push(`- Sık değer önerileri: ${insight.top_value_props.slice(0, 6).map((v) => v.token).join(', ')}`)
    }
    if (insight.offer_patterns.length) {
      lines.push(`- Tekrar eden teklifler: ${insight.offer_patterns.slice(0, 6).map((o) => o.token).join(', ')}`)
    }
    if (insight.common_phrases.length) {
      lines.push(`- Yaygın ifadeler: ${insight.common_phrases.slice(0, 6).join(', ')}`)
    }
  }

  if (hasSamples) {
    lines.push('')
    lines.push('### Örnek rakip reklamlar')
    for (const ad of sampleAds.slice(0, MAX_SAMPLES)) {
      const adv = ad.advertiser_name || 'Bilinmeyen reklamveren'
      const active = ad.is_active ? 'aktif' : 'pasif'
      // Metin döndürmeyen kaynak (örn. Google transparency) → dürüst etiket
      if (ad.text_available === false || (!ad.ad_title && !ad.ad_body)) {
        lines.push(`- ${adv} (${active}): [reklam metni mevcut değil — yalnızca reklamveren/format sinyali]`)
        continue
      }
      const parts: string[] = []
      if (ad.ad_title) parts.push(`başlık: "${cap(ad.ad_title, 120)}"`)
      if (ad.ad_body) parts.push(`metin: "${cap(ad.ad_body, MAX_BODY)}"`)
      if (ad.call_to_action) parts.push(`CTA: ${ad.call_to_action}`)
      lines.push(`- ${adv} (${active}) — ${parts.join(' · ')}`)
    }
  }

  return lines.join('\n')
}
