/* ──────────────────────────────────────────────────────────
   Campaign Intent Engine

   Kampanya verisinden iş bağlamını (intent profile) çıkarır.
   Önce deterministic heuristic, sonra düşük confidence'da LLM.
   Landing page varsa fetch + analiz edilir.
   Sonuç 7 gün TTL ile campaign_intent_profiles tablosuna cache'lenir.

   Hata durumunda sistem kırılmaz; eksik veri missing_data'ya yazılır.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight, Platform } from './analysisTypes'
import { analyzeLandingPage } from './landingPageAnalyzer'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type FunnelStage = 'awareness' | 'consideration' | 'conversion' | 'full_funnel'

export interface CampaignIntentProfile {
  campaign_id: string
  platform: Platform
  campaign_type: string
  business_domain: string
  offer_type: string
  service_or_product: string
  target_audience: string
  conversion_goal: string
  funnel_stage: FunnelStage
  detected_keywords: string[]
  landing_page_summary: string
  forbidden_claims: string[]
  required_disclaimers: string[]
  confidence: number        // 0–100
  missing_data: string[]
  evidence_json: Record<string, unknown>
  generated_at: string
}

export interface IntentBuildResult {
  profileMap: Record<string, CampaignIntentProfile>
  count: number
  warnings: string[]
}

// ── Domain signal lookup (general — not hardcoded for any business) ────────────

interface DomainEntry {
  domain: string
  keywords: string[]
}

const DOMAIN_SIGNALS: DomainEntry[] = [
  { domain: 'mesleki belgelendirme', keywords: ['belge', 'sertifika', 'yeterlilik', 'mesleki', 'sınav', 'mys', 'meb', 'megep', 'ehliyet', 'diploma', 'akreditasyon', 'onay belgesi'] },
  { domain: 'eğitim ve kurs', keywords: ['kurs', 'eğitim', 'öğrenim', 'training', 'okul', 'seminer', 'workshop', 'online eğitim', 'uzaktan eğitim', 'ders', 'bootcamp'] },
  { domain: 'sağlık hizmetleri', keywords: ['doktor', 'klinik', 'sağlık', 'hastane', 'tedavi', 'randevu', 'muayene', 'eczane', 'terapi', 'diyetisyen', 'psikolog'] },
  { domain: 'e-ticaret / perakende', keywords: ['mağaza', 'satış', 'alışveriş', 'ürün', 'sipariş', 'fiyat', 'indirim', 'kampanya', 'sepet', 'ödeme', 'kargo'] },
  { domain: 'gayrimenkul', keywords: ['kiralık', 'satılık', 'ev', 'daire', 'konut', 'emlak', 'arazi', 'gayrimenkul', 'kat', 'villa', 'residence'] },
  { domain: 'finans ve sigortacılık', keywords: ['kredi', 'banka', 'faiz', 'sigorta', 'yatırım', 'borsa', 'emeklilik', 'poliçe', 'teklif', 'finansman'] },
  { domain: 'turizm ve seyahat', keywords: ['otel', 'tatil', 'uçuş', 'tur', 'rezervasyon', 'seyahat', 'vize', 'bilet', 'konaklama', 'transfer'] },
  { domain: 'yazılım ve teknoloji', keywords: ['yazılım', 'uygulama', 'app', 'platform', 'saas', 'dijital', 'api', 'entegrasyon', 'bulut', 'sunucu', 'geliştirme'] },
  { domain: 'güzellik ve kişisel bakım', keywords: ['kuaför', 'güzellik', 'cilt', 'bakım', 'spa', 'berber', 'epilasyon', 'makyaj', 'saç', 'estetik'] },
  { domain: 'restoran ve gıda', keywords: ['restoran', 'yemek', 'sipariş', 'menü', 'kafe', 'pizza', 'catering', 'fast food', 'paket servis'] },
  { domain: 'hukuk ve danışmanlık', keywords: ['avukat', 'hukuk', 'danışmanlık', 'dava', 'sözleşme', 'muhasebe', 'muhasebeci', 'vergi', 'hukuki destek'] },
  { domain: 'inşaat ve yapı', keywords: ['inşaat', 'tadilat', 'yenileme', 'boya', 'çatı', 'zemin', 'yapı', 'müteahhit', 'dekorasyon', 'tesisat'] },
  { domain: 'otomotiv', keywords: ['araba', 'araç', 'oto', 'servis', 'lastik', 'yedek parça', 'galeri', 'sıfır km', 'ikinci el'] },
  { domain: 'lojistik ve taşımacılık', keywords: ['kargo', 'lojistik', 'nakliye', 'taşıma', 'depo', 'sevkiyat', 'kurye'] },
  { domain: 'medya ve içerik', keywords: ['yayın', 'dergi', 'haber', 'podcast', 'youtube', 'içerik', 'abone', 'abonelik'] },
]

// ── Offer type signals ────────────────────────────────────────────────────────

interface OfferEntry {
  offer_type: string
  keywords: string[]
}

const OFFER_SIGNALS: OfferEntry[] = [
  { offer_type: 'sınav ve belgelendirme hizmeti', keywords: ['belge', 'sertifika', 'sınav', 'yeterlilik', 'akreditasyon', 'ehliyet', 'diploma'] },
  { offer_type: 'eğitim programı', keywords: ['kurs', 'eğitim', 'training', 'öğretim', 'seminer', 'ders', 'workshop', 'bootcamp'] },
  { offer_type: 'hizmet başvurusu', keywords: ['başvuru', 'form', 'kayıt', 'müvekkil', 'iletişim', 'teklif', 'randevu', 'danışma'] },
  { offer_type: 'ürün satışı', keywords: ['satın al', 'sipariş', 'sepete ekle', 'fiyat listesi', 'indirim', 'katalog', 'ürün'] },
  { offer_type: 'üyelik ve abonelik', keywords: ['üye', 'abone', 'kayıt ol', 'hesap aç', 'giriş yap', 'premium', 'plan'] },
  { offer_type: 'rezervasyon', keywords: ['rezervasyon', 'yer ayırt', 'otel', 'bilet', 'randevu al', 'book'] },
  { offer_type: 'lead / iletişim', keywords: ['bize ulaşın', 'mesaj gönder', 'whatsapp', 'arayın', 'bilgi alın', 'demo'] },
  { offer_type: 'uygulama indirme', keywords: ['indir', 'app', 'uygulama', 'google play', 'app store', 'install'] },
]

// ── Funnel stage mapping ──────────────────────────────────────────────────────

function mapFunnelStage(objective: string, platform: Platform): FunnelStage {
  const obj = objective.toUpperCase()

  // Meta
  if (platform === 'Meta') {
    if (['OUTCOME_AWARENESS', 'REACH', 'BRAND_AWARENESS', 'VIDEO_VIEWS'].includes(obj)) return 'awareness'
    if (['OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'LINK_CLICKS'].includes(obj)) return 'consideration'
    if (['OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_APP_PROMOTION', 'CONVERSIONS'].includes(obj)) return 'conversion'
    return 'consideration'
  }

  // Google
  if (['VIDEO', 'DISPLAY', 'DEMAND_GEN'].includes(obj)) return 'awareness'
  if (['SEARCH'].includes(obj)) return 'conversion'
  if (['PERFORMANCE_MAX', 'SHOPPING'].includes(obj)) return 'full_funnel'
  return 'conversion'
}

// ── Text signal extraction ────────────────────────────────────────────────────

function collectTextSignals(campaign: DeepCampaignInsight): string[] {
  const signals: string[] = []

  // Campaign & adset names
  signals.push(campaign.campaignName)
  for (const adset of campaign.adsets) {
    signals.push(adset.name)
    for (const ad of adset.ads) {
      signals.push(ad.name)
      if (ad.creativeBody) signals.push(ad.creativeBody)
      if (ad.creativeTitle) signals.push(ad.creativeTitle)
    }
  }

  // Objective
  signals.push(campaign.objective)
  if (campaign.channelType) signals.push(campaign.channelType)

  // Keywords from Google RSA (if stored in ad.name or future extension)
  // The deepFetcher may embed keyword data — collect from adset names as proxy
  return signals.filter(Boolean)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sığüşöçİĞÜŞÖÇ]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3)
}

function collectAllTokens(signals: string[]): string[] {
  const tokens: string[] = []
  for (const s of signals) tokens.push(...tokenize(s))
  return [...new Set(tokens)]
}

// ── Score-based domain + offer detection ─────────────────────────────────────

function detectDomain(tokens: string[]): { domain: string; score: number } {
  let best = { domain: 'genel', score: 0 }
  for (const entry of DOMAIN_SIGNALS) {
    let score = 0
    for (const kw of entry.keywords) {
      if (tokens.some(t => t.includes(kw) || kw.includes(t))) score++
    }
    if (score > best.score) best = { domain: entry.domain, score }
  }
  return best
}

function detectOfferType(tokens: string[]): { offer_type: string; score: number } {
  let best = { offer_type: 'genel hizmet', score: 0 }
  for (const entry of OFFER_SIGNALS) {
    let score = 0
    for (const kw of entry.keywords) {
      const kwTokens = tokenize(kw)
      if (kwTokens.some(kt => tokens.some(t => t.includes(kt) || kt.includes(t)))) score++
    }
    if (score > best.score) best = { offer_type: entry.offer_type, score }
  }
  return best
}

// Extract probable service/product name from campaign name (first 2-4 meaningful words)
function detectServiceOrProduct(signals: string[], tokens: string[]): string {
  // Try to extract from campaign name first
  const campaignName = signals[0] || ''

  // Remove common filler words (Turkish)
  const fillers = new Set([
    'için', 'ile', 've', 'veya', 'da', 'de', 'den', 'dan', 'bir', 'bu', 'şu', 'o',
    'reklam', 'kampanya', 'arama', 'google', 'meta', 'facebook', 'instagram', 'ads',
    'display', 'search', 'video', 'performance', 'max', 'pmax', 'shopping',
  ])

  const meaningful = tokenize(campaignName)
    .filter(t => t.length >= 4 && !fillers.has(t))
    .slice(0, 4)

  if (meaningful.length >= 1) {
    return meaningful.join(' ')
  }

  // Fallback: most frequent non-filler token from all signals
  const freq: Record<string, number> = {}
  for (const t of tokens) {
    if (!fillers.has(t) && t.length >= 4) freq[t] = (freq[t] || 0) + 1
  }
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3)
  return sorted.map(([t]) => t).join(' ') || 'belirtilmemiş'
}

function detectTargetAudience(campaign: DeepCampaignInsight, domain: string): string {
  // Infer from targeting description, ad group names, and domain
  const adsetNames = campaign.adsets.map(a => a.name).join(' ')
  const nameLower = adsetNames.toLowerCase()

  if (nameLower.includes('retarget') || nameLower.includes('yeniden')) return 'web sitesi ziyaretçileri (retargeting)'
  if (nameLower.includes('lookalike') || nameLower.includes('benzer')) return 'benzer kitle (lookalike)'
  if (nameLower.includes('geniş') || nameLower.includes('broad')) return 'geniş kitle'

  // Domain-based audience hints
  const domainAudienceMap: Record<string, string> = {
    'mesleki belgelendirme': 'belge almak isteyen profesyoneller ve meslek sahipleri',
    'eğitim ve kurs': 'öğrenmek isteyen bireyler, kariyer gelişimi arayanlar',
    'sağlık hizmetleri': 'sağlık hizmeti arayanlar, hasta ve yakınları',
    'e-ticaret / perakende': 'ürün araştıran ve satın almaya hazır tüketiciler',
    'gayrimenkul': 'ev veya mülk arayan bireyler ve yatırımcılar',
    'finans ve sigortacılık': 'finansal ürün araştıran bireyler ve işletmeler',
    'turizm ve seyahat': 'tatil ve seyahat planlayan bireyler',
    'yazılım ve teknoloji': 'dijital çözüm arayan işletmeler ve geliştiriciler',
    'güzellik ve kişisel bakım': 'güzellik hizmeti arayanlar',
    'restoran ve gıda': 'yemek siparişi verenler, restoran arayanlar',
    'hukuk ve danışmanlık': 'hukuki veya mali danışmanlık arayanlar',
    'inşaat ve yapı': 'yapı veya tadilat hizmeti arayanlar',
    'otomotiv': 'araç satın almayı veya servis yaptırmayı düşünenler',
  }
  return domainAudienceMap[domain] || 'hedef kitlesi belirtilmemiş'
}

function detectConversionGoal(campaign: DeepCampaignInsight): string {
  const obj = campaign.objective.toUpperCase()
  const adsetNames = campaign.adsets.map(a => a.name + ' ' + (a.optimizationGoal || '') + ' ' + (a.destinationType || '')).join(' ').toLowerCase()

  // From destination / optimization goal
  for (const adset of campaign.adsets) {
    const dest = adset.destinationType?.toUpperCase() || ''
    const optGoal = adset.optimizationGoal?.toUpperCase() || ''

    if (dest === 'ON_AD' || optGoal === 'LEAD_GENERATION') return 'lead formu doldurma'
    if (dest === 'WHATSAPP' || dest === 'MESSENGER' || dest === 'INSTAGRAM_DIRECT') return 'mesaj yoluyla iletişim'
    if (dest === 'WEBSITE' && obj.includes('SALES')) return 'web sitesinde satın alma'
    if (dest === 'WEBSITE' && obj.includes('LEADS')) return 'iletişim formu doldurma'
    if (dest === 'APP' || optGoal === 'APP_INSTALLS') return 'uygulama indirme'
  }

  // From objective
  if (obj.includes('LEADS') || adsetNames.includes('başvuru') || adsetNames.includes('form')) return 'başvuru / form doldurma'
  if (obj.includes('SALES') || obj === 'SHOPPING') return 'ürün satın alma'
  if (obj.includes('AWARENESS') || obj === 'VIDEO') return 'marka bilinirliği artırma'
  if (obj.includes('TRAFFIC') || obj.includes('CLICKS')) return 'web sitesine trafik çekme'
  if (obj.includes('ENGAGEMENT')) return 'sosyal medya etkileşimi'
  if (obj === 'SEARCH') return 'web sitesi ziyareti veya başvuru'
  if (obj === 'PERFORMANCE_MAX') return 'genel dönüşüm optimizasyonu'

  return 'dönüşüm hedefi belirtilmemiş'
}

// ── Confidence calculation ────────────────────────────────────────────────────

function calculateHeuristicConfidence(params: {
  domainScore: number
  offerScore: number
  signalCount: number
  hasLandingPage: boolean
  hasMissingData: boolean
}): number {
  let score = 30 // base

  score += Math.min(params.domainScore * 12, 20)   // max +20 from domain signals
  score += Math.min(params.offerScore * 10, 15)     // max +15 from offer signals
  score += Math.min(params.signalCount * 2, 15)     // max +15 from signal count
  if (params.hasLandingPage) score += 15             // +15 if landing page analyzed
  if (params.hasMissingData) score -= 10             // -10 if lots missing

  return Math.max(0, Math.min(90, score))
}

// ── LLM enhancement ───────────────────────────────────────────────────────────

async function enhanceWithLLM(
  rawSignals: string[],
  landingPageSummary: string,
  campaign: DeepCampaignInsight,
  heuristicProfile: Omit<CampaignIntentProfile, 'generated_at'>,
): Promise<Partial<CampaignIntentProfile> | null> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return null

  const system = `Sen bir kampanya analiz uzmanısın. Reklam kampanyası verilerinden iş bağlamını çıkar.
JSON çıktısı üret. Türkçe yaz. Teknik enum kullanma. Gerçekçi ve spesifik ol.
Kural: hardcode varsayım yapma — sadece aşağıdaki verilerden çıkar.`

  const signalBlock = rawSignals.slice(0, 8).join('\n- ')
  const user = `Kampanya Adı: ${campaign.campaignName}
Platform: ${campaign.platform}
Amaç (Objective): ${campaign.objective}
Reklam Seti Sayısı: ${campaign.adsets.length}
Reklam Seti Adları: ${campaign.adsets.map(a => a.name).slice(0, 3).join(', ')}
Metin Sinyalleri:
- ${signalBlock}
${landingPageSummary ? `Landing Page Özeti:\n${landingPageSummary}` : '(Landing page verisi yok)'}
Önceki Heuristic Sonucu (düşük confidence, iyileştir):
- business_domain: ${heuristicProfile.business_domain}
- service_or_product: ${heuristicProfile.service_or_product}
- target_audience: ${heuristicProfile.target_audience}

Aşağıdaki JSON'u doldur:
{
  "business_domain": "sektör / iş alanı (Türkçe, kısa)",
  "offer_type": "ne tür teklif / hizmet",
  "service_or_product": "spesifik ürün veya hizmet adı",
  "target_audience": "hedef kitle tanımı",
  "conversion_goal": "dönüşüm hedefi",
  "detected_keywords": ["anahtar kelime 1", "anahtar kelime 2"],
  "forbidden_claims": [],
  "required_disclaimers": [],
  "confidence": 75
}`

  try {
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) return null

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content
    if (!raw) return null

    const parsed = JSON.parse(raw)

    // Validate required fields
    if (typeof parsed.business_domain !== 'string') return null

    return {
      business_domain: parsed.business_domain || heuristicProfile.business_domain,
      offer_type: parsed.offer_type || heuristicProfile.offer_type,
      service_or_product: parsed.service_or_product || heuristicProfile.service_or_product,
      target_audience: parsed.target_audience || heuristicProfile.target_audience,
      conversion_goal: parsed.conversion_goal || heuristicProfile.conversion_goal,
      detected_keywords: Array.isArray(parsed.detected_keywords)
        ? parsed.detected_keywords.filter((k: unknown) => typeof k === 'string').slice(0, 15)
        : heuristicProfile.detected_keywords,
      forbidden_claims: Array.isArray(parsed.forbidden_claims) ? parsed.forbidden_claims : [],
      required_disclaimers: Array.isArray(parsed.required_disclaimers) ? parsed.required_disclaimers : [],
      confidence: typeof parsed.confidence === 'number'
        ? Math.min(95, Math.max(0, parsed.confidence))
        : heuristicProfile.confidence,
    }
  } catch {
    return null
  }
}

// ── Supabase cache ────────────────────────────────────────────────────────────

const TABLE = 'campaign_intent_profiles'
const TTL_DAYS = 7

async function loadFromCache(
  userId: string,
  platform: string,
  campaignId: string,
): Promise<CampaignIntentProfile | null> {
  try {
    if (!supabase) return null
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('campaign_id', campaignId)
      .maybeSingle()

    if (error || !data) return null

    const expiresAt = data.expires_at ? new Date(data.expires_at) : null
    if (expiresAt && expiresAt < new Date()) return null // expired

    return {
      campaign_id: data.campaign_id,
      platform: data.platform as Platform,
      campaign_type: data.campaign_type || '',
      business_domain: data.business_domain || '',
      offer_type: data.offer_type || '',
      service_or_product: data.service_or_product || '',
      target_audience: data.target_audience || '',
      conversion_goal: data.conversion_goal || '',
      funnel_stage: (data.funnel_stage as FunnelStage) || 'conversion',
      detected_keywords: data.detected_keywords || [],
      landing_page_summary: data.landing_page_summary || '',
      forbidden_claims: data.forbidden_claims || [],
      required_disclaimers: data.required_disclaimers || [],
      confidence: data.confidence || 0,
      missing_data: data.missing_data || [],
      evidence_json: data.evidence_json || {},
      generated_at: data.generated_at || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

async function saveToCache(userId: string, profile: CampaignIntentProfile): Promise<void> {
  try {
    if (!supabase) return
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + TTL_DAYS)

    await supabase.from(TABLE).upsert(
      {
        user_id: userId,
        platform: profile.platform,
        campaign_id: profile.campaign_id,
        campaign_type: profile.campaign_type,
        business_domain: profile.business_domain,
        offer_type: profile.offer_type,
        service_or_product: profile.service_or_product,
        target_audience: profile.target_audience,
        conversion_goal: profile.conversion_goal,
        funnel_stage: profile.funnel_stage,
        detected_keywords: profile.detected_keywords,
        landing_page_summary: profile.landing_page_summary,
        forbidden_claims: profile.forbidden_claims,
        required_disclaimers: profile.required_disclaimers,
        confidence: profile.confidence,
        missing_data: profile.missing_data,
        evidence_json: profile.evidence_json,
        generated_at: profile.generated_at,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform,campaign_id' },
    )
  } catch {
    // Non-fatal — cache write failure doesn't break intent generation
  }
}

// ── Core intent builder ───────────────────────────────────────────────────────

async function buildIntentProfile(
  campaign: DeepCampaignInsight,
  userId: string | null,
  forceRefresh = false,
): Promise<CampaignIntentProfile> {
  const generatedAt = new Date().toISOString()
  const missingData: string[] = []

  // Check cache
  if (userId && !forceRefresh) {
    const cached = await loadFromCache(userId, campaign.platform, campaign.id).catch(() => null)
    if (cached) return cached
  }

  // ── 1. Collect text signals ────────────────────────────────────────────────
  const rawSignals = collectTextSignals(campaign)
  const tokens = collectAllTokens(rawSignals)

  if (rawSignals.length <= 1) missingData.push('ad_text')

  // ── 2. Heuristic extraction ────────────────────────────────────────────────
  const { domain, score: domainScore } = detectDomain(tokens)
  const { offer_type, score: offerScore } = detectOfferType(tokens)
  const serviceOrProduct = detectServiceOrProduct(rawSignals, tokens)
  const targetAudience = detectTargetAudience(campaign, domain)
  const conversionGoal = detectConversionGoal(campaign)
  const funnelStage = mapFunnelStage(campaign.objective, campaign.platform)
  const campaignType = campaign.channelType || campaign.objective || ''

  // Detected keywords: top tokens from signals (not fillers, min 4 chars)
  const fillers = new Set(['için', 'ile', 'veya', 'bir', 'bu', 'reklam', 'kampanya', 'google', 'meta', 'arama', 'search', 'display'])
  const detectedKeywords = tokens
    .filter(t => t.length >= 4 && !fillers.has(t))
    .slice(0, 15)

  // ── 3. Landing page fetch ─────────────────────────────────────────────────
  let landingPageSummary = ''
  let hasLandingPage = false

  const finalUrls: string[] = []
  for (const adset of campaign.adsets) {
    for (const ad of adset.ads) {
      if (ad.linkUrl && /^https?:\/\/.+/i.test(ad.linkUrl)) {
        finalUrls.push(ad.linkUrl)
        break
      }
    }
    if (finalUrls.length > 0) break
  }

  if (finalUrls.length > 0) {
    const lp = await analyzeLandingPage(finalUrls[0]).catch(() => null)
    if (lp && !lp.error && lp.summary) {
      landingPageSummary = lp.summary
      hasLandingPage = true
    } else if (lp?.error) {
      missingData.push(`landing_page_fetch_failed: ${lp.error}`)
    }
  } else {
    missingData.push('final_url')
  }

  if (!campaign.adsets.length) missingData.push('adsets')
  if (!campaign.metrics.spend) missingData.push('spend_data')

  // ── 4. Build heuristic profile ────────────────────────────────────────────
  const confidence = calculateHeuristicConfidence({
    domainScore,
    offerScore,
    signalCount: rawSignals.length,
    hasLandingPage,
    hasMissingData: missingData.length > 2,
  })

  const heuristicProfile: Omit<CampaignIntentProfile, 'generated_at'> = {
    campaign_id: campaign.id,
    platform: campaign.platform,
    campaign_type: campaignType,
    business_domain: domain,
    offer_type,
    service_or_product: serviceOrProduct,
    target_audience: targetAudience,
    conversion_goal: conversionGoal,
    funnel_stage: funnelStage,
    detected_keywords: detectedKeywords,
    landing_page_summary: landingPageSummary,
    forbidden_claims: [],
    required_disclaimers: [],
    confidence,
    missing_data: missingData,
    evidence_json: {
      rawSignals: rawSignals.slice(0, 6),
      domainScore,
      offerScore,
      tokenCount: tokens.length,
      finalUrls,
      campaignName: campaign.campaignName,
      objective: campaign.objective,
    },
  }

  // ── 5. LLM enhancement (only if confidence < 60 and OpenAI available) ─────
  let finalProfile = heuristicProfile
  if (confidence < 60) {
    const llmResult = await enhanceWithLLM(rawSignals, landingPageSummary, campaign, heuristicProfile).catch(() => null)
    if (llmResult) {
      finalProfile = {
        ...heuristicProfile,
        ...llmResult,
        evidence_json: { ...heuristicProfile.evidence_json, llm_enhanced: true },
      }
    }
  }

  const profile: CampaignIntentProfile = { ...finalProfile, generated_at: generatedAt }

  // ── 6. Store to cache ─────────────────────────────────────────────────────
  if (userId) {
    await saveToCache(userId, profile).catch(() => null)
  }

  return profile
}

// ── Batch builder (main export) ───────────────────────────────────────────────

export async function buildIntentProfilesForCampaigns(
  campaigns: DeepCampaignInsight[],
  options: { userId: string | null; forceRefresh?: boolean },
): Promise<IntentBuildResult> {
  const { userId, forceRefresh = false } = options
  const profileMap: Record<string, CampaignIntentProfile> = {}
  const warnings: string[] = []

  const active = campaigns.filter(
    c => c.status === 'ACTIVE' || c.status === 'ENABLED',
  )

  for (const campaign of active) {
    try {
      const profile = await buildIntentProfile(campaign, userId, forceRefresh)
      profileMap[campaign.id] = profile
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push(`Intent build failed for ${campaign.id}: ${msg}`)
    }
  }

  return {
    profileMap,
    count: Object.keys(profileMap).length,
    warnings,
  }
}

// ── Format for prompt injection ───────────────────────────────────────────────

export function formatIntentForPrompt(profile: CampaignIntentProfile): string {
  const lines: string[] = [
    `  KAMPANYA INTENT (güven: ${profile.confidence}/100):`,
    `  İş Alanı: ${profile.business_domain}`,
    `  Ürün/Hizmet: ${profile.service_or_product}`,
    `  Teklif Türü: ${profile.offer_type}`,
    `  Hedef Kitle: ${profile.target_audience}`,
    `  Dönüşüm Hedefi: ${profile.conversion_goal}`,
    `  Huni Aşaması: ${profile.funnel_stage}`,
  ]

  if (profile.detected_keywords.length > 0) {
    lines.push(`  Anahtar Kelimeler: ${profile.detected_keywords.slice(0, 8).join(', ')}`)
  }

  if (profile.landing_page_summary) {
    lines.push(`  Landing Page:\n    ${profile.landing_page_summary.replace(/\n/g, '\n    ').slice(0, 400)}`)
  }

  if (profile.missing_data.length > 0) {
    lines.push(`  Eksik Veri: ${profile.missing_data.join(', ')}`)
  }

  return lines.join('\n')
}
