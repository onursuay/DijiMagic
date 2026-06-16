import 'server-only'
import { claudeJson, isClaudeReady } from '@/lib/anthropic/text'
import { pickStockImage, pickStockImages, isStockReady } from '../stock'
import { scanReferences } from '../referenceScanner'
import { labelsFor, formLabelsFor, type SiteLabels } from '../templates/deterministic'
import type { WebsitePageInput, SectionBlock, SiteType, PageRole } from '../types'
import type { BusinessProfileRow, BusinessIntelligenceRow } from '@/lib/yoai/businessProfileStore'

/**
 * AI üretim motoru. Claude SABİT bir içerik şemasını doldurur (yapıyı uydurmaz);
 * header/footer/nav güvenli şekilde DETERMİNİSTİK monte edilir; görseller stoktan bağlanır.
 * Görsel-zengin, modern bölüm seti (referans kalitesi): hero · services(görselli) · split ·
 * gallery · features · about · cta · contact.
 *
 * SAHTE VERİ YASAĞI (feedback_no_fake_data): uydurma müşteri yorumu (testimonial) ve kanıtsız
 * istatistik (stats) ÜRETİLMEZ — render bileşenleri ileride gerçek veri için durur.
 */

interface BrandSynthesisLike {
  brand_voice?: string | null
  value_proposition?: string | null
  messaging_pillars?: string[]
  differentiators?: string[]
  suggested_keywords?: string[]
  tone_guidance?: string | null
}

interface AiServiceItem { title?: string; description?: string; imageQuery?: string }
interface AiContent {
  hero?: { eyebrow?: string; title?: string; subtitle?: string; ctaLabel?: string; secondaryCtaLabel?: string; imageQuery?: string }
  services?: { eyebrow?: string; heading?: string; intro?: string; items?: AiServiceItem[] }
  split?: { eyebrow?: string; heading?: string; body?: string; bullets?: string[]; imageQuery?: string }
  gallery?: { eyebrow?: string; heading?: string; imageQuery?: string }
  features?: { eyebrow?: string; heading?: string; items?: { title?: string; description?: string }[] }
  about?: { eyebrow?: string; heading?: string; body?: string; imageQuery?: string }
  cta?: { heading?: string; body?: string; ctaLabel?: string }
  contact?: { heading?: string; body?: string }
}

export interface GenerateInput {
  subdomain: string
  siteType: SiteType
  label: string
  profile: BusinessProfileRow | null
  intelligence: BusinessIntelligenceRow | null
  locale: string
  instructions?: string
  referenceUrls?: string[]
  /** Revize modu: 'reject' → tamamen farklı yön; 'edit' → mevcut yapıyı koru, hedefli değiştir. */
  revisionMode?: 'reject' | 'edit'
  /** 'edit' modunda AI'ın neyi değiştireceğini bilmesi için mevcut sitenin içerik özeti. */
  currentSummary?: string
}

export function isWebsiteAiReady(): boolean {
  return isClaudeReady()
}

const clean = (s: string | null | undefined): string => (typeof s === 'string' ? s.trim() : '')

const LANG_NAMES: Record<string, string> = {
  tr: 'Turkish', en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian',
  pt: 'Portuguese', nl: 'Dutch', ru: 'Russian', pl: 'Polish', sv: 'Swedish', da: 'Danish',
  no: 'Norwegian', fi: 'Finnish', el: 'Greek', cs: 'Czech', ro: 'Romanian', hu: 'Hungarian',
  uk: 'Ukrainian', bg: 'Bulgarian', sr: 'Serbian', hr: 'Croatian', sk: 'Slovak', ar: 'Arabic',
  fa: 'Persian', he: 'Hebrew', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', hi: 'Hindi',
  th: 'Thai', id: 'Indonesian', vi: 'Vietnamese', az: 'Azerbaijani',
}

function buildPrompt(input: GenerateInput, ai: BrandSynthesisLike, refSummaries: string[]): { system: string; user: string } {
  const p = input.profile
  const intel = input.intelligence
  const langName = LANG_NAMES[input.locale] ?? 'Turkish'

  const facts: string[] = []
  const add = (k: string, v: string | null | undefined | string[]) => {
    const val = Array.isArray(v) ? v.filter(Boolean).join(', ') : clean(v as string)
    if (val) facts.push(`${k}: ${val}`)
  }
  add('Firma', p?.company_name)
  add('Sektör', [p?.sector_main, p?.sector_sub].filter(Boolean).join(' / '))
  add('Uzmanlık', p?.specialization)
  add('Açıklama', p?.business_description)
  add('Ürün/Hizmetler', p?.products_or_services)
  add('Öne çıkan hizmetler', p?.most_profitable_services)
  add('Hedef kitle', p?.target_audience)
  add('Lokasyonlar', p?.target_locations)
  add('Marka tonu', p?.brand_tone)
  add('Anahtar kelimeler', p?.keywords)
  add('Değer önerisi', ai.value_proposition)
  add('Marka sesi', ai.brand_voice)
  add('Mesaj sütunları', ai.messaging_pillars)
  add('Farklılaştırıcılar', ai.differentiators)
  add('Şirket özeti', intel?.company_summary)
  if (p?.forbidden_claims?.length) facts.push(`YASAK iddialar (asla kullanma): ${p.forbidden_claims.join(', ')}`)

  const trRule =
    input.locale === 'tr'
      ? 'Tüm içeriği akıcı, dilbilgisi ve imla açısından KUSURSUZ Türkçe yaz (ç, ğ, ı, İ, ö, ş, ü eksiksiz; ASCII eşdeğer YASAK; kesme işareti doğru).'
      : `Write ALL content fluently and natively in ${langName}. Use correct ${langName} grammar, spelling and punctuation.`

  const system = [
    'Sen kıdemli bir web içerik editörü, marka metni yazarı ve UX yazarısın.',
    'Verilen işletme gerçeklerinden, dönüşüm odaklı, markaya uygun, MODERN bir web sitesi metni üret.',
    'KURALLAR:',
    `- ${trRule}`,
    '- UYDURMA YOK: yalnız verilen gerçeklere dayan. Bilmediğin somut iddiayı (ödül, yıl, müşteri sayısı, garanti, yüzde, rakam) ASLA uydurma.',
    '- Marka tonuna uy; abartılı/klişe pazarlama dilinden kaçın. Kısa, net, güçlü cümleler.',
    '- hero.title KISA ve etkileyici olsun (en fazla ~7 kelime); subtitle 1-2 cümle.',
    '- eyebrow alanları 1-3 kelimelik kısa üst-etiket (örn. sektör, şehir, kısa slogan).',
    '- İÇERİK ZAYIF/JENERİK OLMASIN: her metin gerçek bir profesyonel web sitesindeki gibi DOLU, özgün ve ikna edici olsun. "Kaliteli hizmet sunuyoruz" gibi boş kalıplar YASAK — işletmeye özgü somut fayda/değer yaz.',
    '- services.items: GERÇEK hizmet/ürünlerle doldur (3-6 adet), her birinin 1-2 cümlelik somut, fayda-odaklı açıklaması olsun.',
    '- features.items: somut fayda/farklılık (3-4 adet), her biri 1-2 cümle açıklamalı.',
    '- split: değer önerisini anlatan bir bölüm; bullets 3-4 kısa somut madde.',
    '- about.body 2-3 dolu cümle (marka hikayesi/yaklaşımı). contact.body kısa ve davetkâr. cta dönüşüme yönlendiren güçlü bir çağrı.',
    '- imageQuery alanları İNGİLİZCE, kısa, görsel arama için spesifik olsun (örn. "modern dental clinic interior", "fresh organic olive oil bottles"). Her imageQuery FARKLI bir sahne betimlesin.',
    '- REFERANS site özetleri verilmişse onların yapı/ton/düzen MANTIĞINI ilham al ve YAKLAŞTIR; ama ASLA birebir kopyalama — özgün metin üret.',
    '- Yalnız istenen JSON şemasını döndür; ek açıklama, markdown veya kod bloğu YOK.',
  ].join('\n')

  // Revize modu çerçevesi: reject = tamamen farklı yön; edit = mevcut yapıyı koru, hedefli değiştir.
  let revisionBlock = ''
  if (input.instructions) {
    if (input.revisionMode === 'reject') {
      revisionBlock =
        `KULLANICI MEVCUT TASARIMI REDDETTİ. Şikayet/istek:\n${input.instructions}\n\n` +
        'BU SEFER TAMAMEN FARKLI BİR YÖN DENE: farklı bölüm düzeni, farklı ton, farklı görsel yaklaşımı, farklı başlık dili. Önceki tasarımı TEKRARLAMA; kullanıcının şikayetini gider.\n'
    } else if (input.revisionMode === 'edit') {
      revisionBlock = `KULLANICI ŞU NOKTALARI DÜZELTMEK İSTİYOR (YALNIZ bunları değiştir, belirtilmeyen her şeyi AYNI KORU):\n${input.instructions}\n`
      if (input.currentSummary && input.currentSummary.trim()) {
        revisionBlock += `\nMEVCUT SİTE İÇERİĞİ (bunu referans al; düzeltme istenmeyen bölüm/metinleri olduğu gibi koru):\n${input.currentSummary}\n`
      } else {
        revisionBlock += '\nBu dilde henüz içerik yok; işletme verisinden tutarlı bir site üret ve yukarıdaki kullanıcı düzeltmelerini uygula.\n'
      }
    } else {
      revisionBlock = `KULLANICI DÜZELTMELERİ/İSTEKLERİ (önceliklidir):\n${input.instructions}\n`
    }
  }

  const user = [
    `Dil: ${langName}`,
    `Site tipi: ${input.siteType === 'landing' ? 'Tek sayfa (landing)' : 'Çok sayfalı'}`,
    '',
    'İŞLETME GERÇEKLERİ:',
    facts.length ? facts.join('\n') : '(sınırlı veri — nötr, dürüst ve genel geçer bir metin üret)',
    '',
    revisionBlock,
    refSummaries.length
      ? `REFERANS SİTELER — bu sitelerin HEADER/menü yapısını, bölüm SIRASINI ve genel DÜZEN/yapı mantığını yaklaştır (birebir kopya DEĞİL; özgün metin üret). Yukarıdaki kullanıcı istekleri referanslarla çelişirse KULLANICIYI ÖNCELE:\n${refSummaries.map((s) => `- ${s}`).join('\n')}\n`
      : '',
    'Aşağıdaki JSON şemasını doldur (boş bırakabileceğin alanları boş string yap):',
    `{
  "hero": { "eyebrow": string, "title": string, "subtitle": string, "ctaLabel": string, "secondaryCtaLabel": string, "imageQuery": string },
  "services": { "eyebrow": string, "heading": string, "intro": string, "items": [{ "title": string, "description": string, "imageQuery": string }] },
  "split": { "eyebrow": string, "heading": string, "body": string, "bullets": [string], "imageQuery": string },
  "gallery": { "eyebrow": string, "heading": string, "imageQuery": string },
  "features": { "eyebrow": string, "heading": string, "items": [{ "title": string, "description": string }] },
  "about": { "eyebrow": string, "heading": string, "body": string, "imageQuery": string },
  "cta": { "heading": string, "body": string, "ctaLabel": string },
  "contact": { "heading": string, "body": string }
}`,
  ].join('\n')

  return { system, user }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])
const svcItems = (v: unknown): AiServiceItem[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => ({
      title: str((x as Record<string, unknown>)?.title),
      description: str((x as Record<string, unknown>)?.description),
      imageQuery: str((x as Record<string, unknown>)?.imageQuery),
    }))
    .filter((x) => x.title)
    .slice(0, 6)
const featItems = (v: unknown): { title: string; description: string }[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => ({ title: str((x as Record<string, unknown>)?.title), description: str((x as Record<string, unknown>)?.description) }))
    .filter((x) => x.title)
    .slice(0, 4)

function navFor(input: GenerateInput, L: SiteLabels) {
  if (input.siteType === 'landing') {
    return [
      { label: L.navServices, href: '#services' },
      { label: L.navAbout, href: '#about' },
      { label: L.navContact, href: '#contact' },
    ]
  }
  const base = `/s/${input.subdomain}`
  return [
    { label: L.navHome, href: base },
    { label: L.navServices, href: `${base}/hizmetler` },
    { label: L.navAbout, href: `${base}/hakkimizda` },
    { label: L.navContact, href: `${base}/iletisim` },
  ]
}

const block = (type: string, content: Record<string, unknown>, i: number): SectionBlock => ({ id: `${type}-${i}`, type, content })

async function resolveImage(query: string): Promise<string | null> {
  const q = str(query)
  if (!q || !isStockReady()) return null
  const img = await pickStockImage(q)
  return img?.url ?? null
}

/**
 * AI ile site sayfa modelini üretir. Claude hazır değilse null döner (çağıran deterministik'e düşebilir).
 */
export async function generateSitePages(input: GenerateInput): Promise<WebsitePageInput[] | null> {
  if (!isClaudeReady()) return null
  const ai = ((input.intelligence as unknown as { ai_synthesis?: BrandSynthesisLike } | null)?.ai_synthesis) ?? {}
  const L = labelsFor(input.locale)
  const brand = clean(input.profile?.company_name) || clean(input.label) || (input.locale === 'en' ? 'Your Brand' : 'Markanız')
  const sectorHint = clean([input.profile?.sector_main, input.profile?.sector_sub].filter(Boolean).join(' '))

  const refSummaries = input.referenceUrls?.length ? await scanReferences(input.referenceUrls) : []
  const { system, user } = buildPrompt(input, ai, refSummaries)
  const content = await claudeJson<AiContent>({ system, user, maxTokens: 4000, temperature: 0.6, timeoutMs: 60_000 })
  if (!content) return null

  const services = svcItems(content.services?.items)
  const features = featItems(content.features?.items)

  // Görsel sorguları (her bölüm farklı sahne). Boşsa sektöre dayalı fallback.
  const heroQ = str(content.hero?.imageQuery) || `modern ${sectorHint || 'business'} hero background`
  const aboutQ = str(content.about?.imageQuery) || `professional ${sectorHint || 'business'} team workplace`
  const splitQ = str(content.split?.imageQuery) || `${sectorHint || 'business'} detail closeup`
  const galleryQ = str(content.gallery?.imageQuery) || `${sectorHint || 'business'} showcase`

  // Tüm görselleri paralel çöz
  const [heroImg, aboutImg, splitImg, serviceImgs, galleryImgs] = await Promise.all([
    resolveImage(heroQ),
    resolveImage(aboutQ),
    resolveImage(splitQ),
    Promise.all(services.map((s) => resolveImage(s.imageQuery || `${s.title} ${sectorHint}`))),
    isStockReady() ? pickStockImages(galleryQ, 5) : Promise.resolve([]),
  ])

  // ── Blok kurucular ──
  const heroBlock = (i: number) =>
    block('hero', {
      eyebrow: str(content.hero?.eyebrow) || sectorHint || '',
      title: str(content.hero?.title) || brand,
      subtitle: str(content.hero?.subtitle),
      ctaLabel: str(content.hero?.ctaLabel) || L.contactCta,
      ctaHref: input.siteType === 'landing' ? '#contact' : `/s/${input.subdomain}/iletisim`,
      secondaryCtaLabel: str(content.hero?.secondaryCtaLabel) || L.learnMore,
      secondaryCtaHref: input.siteType === 'landing' ? '#about' : `/s/${input.subdomain}/hakkimizda`,
      imageUrl: heroImg ?? '',
    }, i)

  const servicesBlock = (i: number) =>
    block('services', {
      eyebrow: str(content.services?.eyebrow) || L.servicesEyebrow,
      heading: str(content.services?.heading) || L.services,
      intro: str(content.services?.intro),
      items: services.map((s, idx) => ({ title: s.title, description: s.description, imageUrl: serviceImgs[idx] ?? '' })),
    }, i)

  const splitData = content.split
  const splitBlock = (i: number, side: 'left' | 'right', tone: 'ink' | 'accent') =>
    block('split', {
      eyebrow: str(splitData?.eyebrow),
      heading: str(splitData?.heading) || L.whyUs,
      body: str(splitData?.body) || clean(input.profile?.business_description),
      bullets: strList(splitData?.bullets).slice(0, 5),
      imageUrl: splitImg ?? '',
      imageSide: side,
      tone,
    }, i)

  const galleryBlock = (i: number) =>
    block('gallery', {
      eyebrow: str(content.gallery?.eyebrow),
      heading: str(content.gallery?.heading) || '',
      images: galleryImgs.map((g) => ({ url: g.url, caption: '' })),
    }, i)

  const featuresBlock = (i: number) =>
    block('features', {
      eyebrow: str(content.features?.eyebrow) || L.whyUsEyebrow,
      heading: str(content.features?.heading) || L.whyUs,
      items: features,
    }, i)

  const aboutBlock = (i: number) =>
    block('about', {
      eyebrow: str(content.about?.eyebrow) || L.aboutEyebrow,
      heading: str(content.about?.heading) || L.about,
      body: str(content.about?.body),
      imageUrl: aboutImg ?? '',
    }, i)

  const ctaBlock = (i: number) =>
    block('cta', {
      heading: str(content.cta?.heading) || L.ctaHeading,
      body: str(content.cta?.body),
      ctaLabel: str(content.cta?.ctaLabel) || L.contactCta,
      ctaHref: input.siteType === 'landing' ? '#contact' : `/s/${input.subdomain}/iletisim`,
    }, i)

  // Sosyal linkler gerçek profil verisinden — AI üretmez (uydurma yok)
  const social: { label: string; href: string }[] = []
  const addSocial = (label: string, url: string | null | undefined) => {
    const u = clean(url)
    if (u) social.push({ label, href: u })
  }
  addSocial(L.web, input.profile?.website_url)
  addSocial('Instagram', input.profile?.instagram_url)
  addSocial('Facebook', input.profile?.facebook_url)
  addSocial('LinkedIn', input.profile?.linkedin_url)
  addSocial('YouTube', input.profile?.youtube_url)
  addSocial('TikTok', input.profile?.tiktok_url)
  const footerLocations = (input.profile?.target_locations ?? []).map(clean).filter(Boolean)
  const tagline = str(content.hero?.subtitle) || clean(input.profile?.business_description)
  const servicesHref = input.siteType === 'landing' ? '#services' : `/s/${input.subdomain}/hizmetler`
  const serviceLinks = services.slice(0, 6).map((s) => ({ label: s.title, href: servicesHref }))

  const contactBlock = (i: number) =>
    block('contact', {
      eyebrow: L.contactEyebrow,
      heading: str(content.contact?.heading) || L.contact,
      body: str(content.contact?.body) || L.contactBody,
      locations: footerLocations,
      links: social,
      mapQuery: footerLocations[0] || '',
      formLabels: formLabelsFor(L),
    }, i)

  const header = block('header', { brand, logoUrl: null, nav: navFor(input, L), ctaLabel: L.contactCta, ctaHref: input.siteType === 'landing' ? '#contact' : `/s/${input.subdomain}/iletisim`, homeHref: input.siteType === 'landing' ? '#' : `/s/${input.subdomain}`, menuLabel: L.menuLabel, closeLabel: L.closeLabel }, 0)
  const footer = (i: number) =>
    block('footer', {
      brand, logoUrl: null, note: `© ${brand}`, tagline,
      nav: navFor(input, L), links: social, locations: footerLocations, serviceLinks,
      pagesLabel: L.footerPages, contactLabel: L.footerContact, servicesLabel: L.footerServices,
    }, i)

  const hasFeatures = features.length > 0
  const hasSplit = Boolean(str(splitData?.heading) || str(splitData?.body) || strList(splitData?.bullets).length)
  const hasGallery = galleryImgs.length >= 3
  const desc = str(content.hero?.subtitle) || brand

  const page = (slug: string, role: PageRole, sections: SectionBlock[], seoTitle: string): WebsitePageInput => ({
    locale: input.locale,
    slug,
    pageRole: role,
    sections,
    seo: { title: seoTitle, description: desc },
    orderIndex: 0,
  })

  if (input.siteType === 'landing') {
    // Ritim: hero(görsel) → services(surface) → split(koyu panel) → gallery → features → about → cta(accent) → contact(ink)
    const s: SectionBlock[] = [header, heroBlock(1), servicesBlock(2)]
    let idx = 3
    if (hasSplit) s.push(splitBlock(idx++, 'right', 'ink'))
    if (hasGallery) s.push(galleryBlock(idx++))
    if (hasFeatures) s.push(featuresBlock(idx++))
    s.push(aboutBlock(idx++))
    s.push(ctaBlock(idx++))
    s.push(contactBlock(idx++))
    s.push(footer(idx++))
    return [page('home', 'home', s, brand)]
  }

  // multipage — 4 sayfa
  const home: SectionBlock[] = [header, heroBlock(1), servicesBlock(2)]
  let hidx = 3
  if (hasSplit) home.push(splitBlock(hidx++, 'right', 'ink'))
  if (hasGallery) home.push(galleryBlock(hidx++))
  if (hasFeatures) home.push(featuresBlock(hidx++))
  home.push(ctaBlock(hidx++))
  home.push(footer(hidx++))

  const aboutSections: SectionBlock[] = [header, aboutBlock(1)]
  if (hasFeatures) aboutSections.push(featuresBlock(2))
  aboutSections.push(ctaBlock(98), footer(99))

  const serviceSections: SectionBlock[] = [header, servicesBlock(1)]
  if (hasGallery) serviceSections.push(galleryBlock(2))
  serviceSections.push(ctaBlock(98), footer(99))

  return [
    page('home', 'home', home, brand),
    page('hakkimizda', 'about', aboutSections, `${L.about} — ${brand}`),
    page('hizmetler', 'services', serviceSections, `${L.services} — ${brand}`),
    page('iletisim', 'contact', [header, contactBlock(1), footer(2)], `${L.contact} — ${brand}`),
  ]
}
