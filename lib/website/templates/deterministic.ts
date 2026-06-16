import 'server-only'
import type { BusinessProfileRow, BusinessIntelligenceRow } from '@/lib/yoai/businessProfileStore'
import type { WebsitePageInput, SectionBlock, SiteType, PageRole } from '../types'
import { pickStockImage, pickStockImages, isStockReady } from '../stock'
import { stockThemeForSector } from '../render/theme'

/**
 * Profil + intelligence verisinden DETERMİNİSTİK (AI'sız, kredisiz) bir sayfa modeli üretir.
 * "Hızlı Oluştur" akışı. Görsel-zengin: hero/about/split + galeri + görselli servis kartları
 * sektöre göre stoktan bağlanır (Pexels). AI yolu (generate.ts) daha zengin metin üretir.
 * Kurallar:
 *  - Uydurma iddia YOK — metin yalnız gerçek profil alanlarından; alan boşsa nötr ifade.
 *  - Site içeriği site diline göre (TR/EN) — sabit etiketler aşağıdaki sözlükten gelir.
 *  - Sahte müşteri yorumu / kanıtsız istatistik üretilmez (feedback_no_fake_data).
 */

interface BrandSynthesisLike {
  brand_voice?: string | null
  value_proposition?: string | null
  messaging_pillars?: string[]
  differentiators?: string[]
  suggested_keywords?: string[]
  tone_guidance?: string | null
}

export interface SiteLabels {
  contactCta: string
  learnMore: string
  services: string
  servicesEyebrow: string
  whyUs: string
  whyUsEyebrow: string
  about: string
  aboutEyebrow: string
  ctaHeading: string
  contact: string
  contactBody: string
  web: string
  navHome: string
  navServices: string
  navAbout: string
  navContact: string
  footerPages: string
  footerContact: string
  footerServices: string
  menuLabel: string
  closeLabel: string
  contactEyebrow: string
  formName: string
  formEmail: string
  formPhone: string
  formMessage: string
  formSend: string
  formSending: string
  formSuccess: string
  formError: string
}

/** ContactForm island'a geçilecek site-dili form etiketleri. */
export function formLabelsFor(L: SiteLabels) {
  return {
    name: L.formName, email: L.formEmail, phone: L.formPhone, message: L.formMessage,
    send: L.formSend, sending: L.formSending, success: L.formSuccess, error: L.formError,
  }
}

const LABELS: Record<string, SiteLabels> = {
  tr: {
    contactCta: 'İletişime Geçin',
    learnMore: 'Daha Fazla',
    services: 'Hizmetlerimiz',
    servicesEyebrow: 'Hizmetler',
    whyUs: 'Neden Biz',
    whyUsEyebrow: 'Farkımız',
    about: 'Hakkımızda',
    aboutEyebrow: 'Hikayemiz',
    ctaHeading: 'Bizimle çalışmaya hazır mısınız',
    contact: 'İletişim',
    contactBody: 'Bizimle iletişime geçin, size en kısa sürede dönüş yapalım.',
    web: 'Web Sitesi',
    navHome: 'Ana Sayfa',
    navServices: 'Hizmetler',
    navAbout: 'Hakkımızda',
    navContact: 'İletişim',
    footerPages: 'Sayfalar',
    footerContact: 'İletişim',
    footerServices: 'Hizmetler',
    menuLabel: 'Menü',
    closeLabel: 'Kapat',
    contactEyebrow: 'İletişim',
    formName: 'Adınız Soyadınız',
    formEmail: 'E-posta adresiniz',
    formPhone: 'Telefon (isteğe bağlı)',
    formMessage: 'Mesajınız',
    formSend: 'Gönder',
    formSending: 'Gönderiliyor…',
    formSuccess: 'Mesajınız iletildi. En kısa sürede dönüş yapacağız.',
    formError: 'Gönderilemedi, lütfen tekrar deneyin.',
  },
  en: {
    contactCta: 'Get in Touch',
    learnMore: 'Learn More',
    services: 'Our Services',
    servicesEyebrow: 'Services',
    whyUs: 'Why Us',
    whyUsEyebrow: 'Our Difference',
    about: 'About',
    aboutEyebrow: 'Our Story',
    ctaHeading: 'Ready to work with us',
    contact: 'Contact',
    contactBody: 'Get in touch and we will get back to you shortly.',
    web: 'Website',
    navHome: 'Home',
    navServices: 'Services',
    navAbout: 'About',
    navContact: 'Contact',
    footerPages: 'Pages',
    footerContact: 'Contact',
    footerServices: 'Services',
    menuLabel: 'Menu',
    closeLabel: 'Close',
    contactEyebrow: 'Contact',
    formName: 'Your name',
    formEmail: 'Your email',
    formPhone: 'Phone (optional)',
    formMessage: 'Your message',
    formSend: 'Send',
    formSending: 'Sending…',
    formSuccess: 'Your message has been sent. We will get back to you shortly.',
    formError: 'Could not send, please try again.',
  },
}

export const labelsFor = (locale: string): SiteLabels => LABELS[locale] ?? LABELS.tr

const clean = (s: string | null | undefined): string => (typeof s === 'string' ? s.trim() : '')
const firstSentence = (s: string): string => {
  const m = s.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : s).trim()
}

export interface BuildSiteInput {
  subdomain: string
  siteType: SiteType
  label: string
  profile: BusinessProfileRow | null
  intelligence: BusinessIntelligenceRow | null
  locale: string
}

function block(type: string, content: Record<string, unknown>, i: number): SectionBlock {
  return { id: `${type}-${i}`, type, content }
}

function deriveBrand(input: BuildSiteInput): string {
  return clean(input.profile?.company_name) || clean(input.label) || 'Markanız'
}

function socialLinks(p: BusinessProfileRow | null, L: SiteLabels): { label: string; href: string }[] {
  if (!p) return []
  const out: { label: string; href: string }[] = []
  const add = (label: string, url: string | null) => {
    const u = clean(url)
    if (u) out.push({ label, href: u })
  }
  add(L.web, p.website_url)
  add('Instagram', p.instagram_url)
  add('Facebook', p.facebook_url)
  add('LinkedIn', p.linkedin_url)
  add('YouTube', p.youtube_url)
  add('TikTok', p.tiktok_url)
  return out
}

function serviceTitles(input: BuildSiteInput): string[] {
  const list = (input.profile?.most_profitable_services?.length
    ? input.profile.most_profitable_services
    : input.profile?.products_or_services) ?? []
  return list.map((s) => clean(s)).filter(Boolean).slice(0, 6)
}

function differentiators(input: BuildSiteInput, ai: BrandSynthesisLike): string[] {
  const source =
    (ai.differentiators?.length && ai.differentiators) ||
    (ai.messaging_pillars?.length && ai.messaging_pillars) ||
    (input.intelligence?.recommended_content_angles?.length && input.intelligence.recommended_content_angles) ||
    []
  return (source as string[]).map((t) => clean(t)).filter(Boolean).slice(0, 5)
}

/** Verilen siteye göre sayfa modelini üretir (landing = tek sayfa; multipage = 4 sayfa). Görseller stoktan. */
export async function buildDeterministicSite(input: BuildSiteInput): Promise<WebsitePageInput[]> {
  const ai = ((input.intelligence as unknown as { ai_synthesis?: BrandSynthesisLike } | null)?.ai_synthesis) ?? {}
  const L = labelsFor(input.locale)
  const brand = deriveBrand(input)
  const locale = input.locale
  const sector = clean([input.profile?.sector_main, input.profile?.sector_sub].filter(Boolean).join(' '))
  const theme = stockThemeForSector(sector)

  const svcTitles = serviceTitles(input)
  const diffs = differentiators(input, ai)

  // Görselleri paralel çöz (stok hazırsa)
  const ready = isStockReady()
  const [heroImg, aboutImg, splitImg, serviceImgs, galleryImgs] = await Promise.all([
    ready ? pickStockImage(theme.hero) : Promise.resolve(null),
    ready ? pickStockImage(theme.about) : Promise.resolve(null),
    ready ? pickStockImage(theme.detail) : Promise.resolve(null),
    ready && svcTitles.length ? pickStockImages(theme.service, svcTitles.length) : Promise.resolve([]),
    ready ? pickStockImages(theme.gallery, 5) : Promise.resolve([]),
  ])

  const summary =
    clean(input.profile?.business_description) ||
    clean(input.intelligence?.company_summary) ||
    clean(ai.brand_voice)
  const heroTitle = clean(ai.value_proposition) || clean(input.profile?.specialization) || brand
  const heroSub = summary ? firstSentence(summary) : ''
  const tagline = heroSub

  const heroBlock = (i: number) =>
    block('hero', {
      eyebrow: sector || '',
      title: heroTitle,
      subtitle: heroSub,
      ctaLabel: L.contactCta,
      ctaHref: input.siteType === 'landing' ? '#contact' : `/s/${input.subdomain}/iletisim`,
      secondaryCtaLabel: L.learnMore,
      secondaryCtaHref: input.siteType === 'landing' ? '#about' : `/s/${input.subdomain}/hakkimizda`,
      imageUrl: heroImg?.url ?? '',
    }, i)

  const servicesBlock = (i: number) =>
    block('services', {
      eyebrow: L.servicesEyebrow,
      heading: L.services,
      intro: '',
      items: svcTitles.map((title, idx) => ({ title, description: '', imageUrl: serviceImgs[idx]?.url ?? '' })),
    }, i)

  const splitBlock = (i: number) =>
    block('split', {
      eyebrow: L.whyUsEyebrow,
      heading: L.whyUs,
      body: summary,
      bullets: diffs,
      imageUrl: splitImg?.url ?? '',
      imageSide: 'right',
      tone: 'ink',
    }, i)

  const galleryBlock = (i: number) =>
    block('gallery', {
      eyebrow: '',
      heading: '',
      images: galleryImgs.map((g) => ({ url: g.url, caption: '' })),
    }, i)

  const aboutBlock = (i: number) =>
    block('about', {
      eyebrow: L.aboutEyebrow,
      heading: L.about,
      body: clean(input.intelligence?.company_summary) || clean(input.profile?.business_description) || '',
      imageUrl: aboutImg?.url ?? '',
    }, i)

  const ctaBlock = (i: number) =>
    block('cta', {
      heading: L.ctaHeading,
      body: '',
      ctaLabel: L.contactCta,
      ctaHref: input.siteType === 'landing' ? '#contact' : `/s/${input.subdomain}/iletisim`,
    }, i)

  const contactLocations = (input.profile?.target_locations ?? []).map(clean).filter(Boolean)
  const contactBlock = (i: number) =>
    block('contact', {
      eyebrow: L.contactEyebrow,
      heading: L.contact,
      body: L.contactBody,
      locations: contactLocations,
      links: socialLinks(input.profile, L),
      mapQuery: contactLocations[0] || '',
      formLabels: formLabelsFor(L),
    }, i)

  const social = socialLinks(input.profile, L)
  const locations = (input.profile?.target_locations ?? []).map(clean).filter(Boolean)
  const navAnchors = [
    { label: L.navServices, href: '#services' },
    { label: L.navAbout, href: '#about' },
    { label: L.navContact, href: '#contact' },
  ]
  const base = `/s/${input.subdomain}`
  const navPaths = [
    { label: L.navHome, href: base },
    { label: L.navServices, href: `${base}/hizmetler` },
    { label: L.navAbout, href: `${base}/hakkimizda` },
    { label: L.navContact, href: `${base}/iletisim` },
  ]
  const nav = input.siteType === 'landing' ? navAnchors : navPaths
  const servicesHref = input.siteType === 'landing' ? '#services' : `${base}/hizmetler`
  const serviceLinks = svcTitles.slice(0, 6).map((t) => ({ label: t, href: servicesHref }))
  const headerBlock = (i: number) =>
    block('header', { brand, logoUrl: null, nav, ctaLabel: L.contactCta, ctaHref: input.siteType === 'landing' ? '#contact' : `${base}/iletisim`, homeHref: input.siteType === 'landing' ? '#' : base, menuLabel: L.menuLabel, closeLabel: L.closeLabel }, i)
  const footerBlock = (i: number) =>
    block('footer', {
      brand, logoUrl: null, note: `© ${brand}`, tagline,
      nav, links: social, locations, serviceLinks,
      pagesLabel: L.footerPages, contactLabel: L.footerContact, servicesLabel: L.footerServices,
    }, i)

  const hasServices = svcTitles.length > 0
  const hasSplit = Boolean(summary) || diffs.length > 0
  const hasGallery = galleryImgs.length >= 3

  const page = (slug: string, pageRole: PageRole, sections: SectionBlock[], seoTitle: string): WebsitePageInput => ({
    locale,
    slug,
    pageRole,
    sections,
    seo: { title: seoTitle, description: clean(input.profile?.business_description) || brand },
    orderIndex: 0,
  })

  if (input.siteType === 'landing') {
    const s: SectionBlock[] = [headerBlock(0), heroBlock(1)]
    let i = 2
    if (hasServices) s.push(servicesBlock(i++))
    if (hasSplit) s.push(splitBlock(i++))
    if (hasGallery) s.push(galleryBlock(i++))
    s.push(aboutBlock(i++))
    s.push(ctaBlock(i++))
    s.push(contactBlock(i++))
    s.push(footerBlock(i++))
    return [page('home', 'home', s, brand)]
  }

  // multipage — 4 sayfa
  const home: SectionBlock[] = [headerBlock(0), heroBlock(1)]
  let hi = 2
  if (hasServices) home.push(servicesBlock(hi++))
  if (hasSplit) home.push(splitBlock(hi++))
  if (hasGallery) home.push(galleryBlock(hi++))
  home.push(ctaBlock(hi++), footerBlock(hi++))

  const aboutSections: SectionBlock[] = [headerBlock(0), aboutBlock(1)]
  if (hasSplit) aboutSections.push(splitBlock(2))
  aboutSections.push(ctaBlock(98), footerBlock(99))

  const serviceSections: SectionBlock[] = [headerBlock(0), servicesBlock(1)]
  if (hasGallery) serviceSections.push(galleryBlock(2))
  serviceSections.push(ctaBlock(98), footerBlock(99))

  return [
    page('home', 'home', home, brand),
    page('hakkimizda', 'about', aboutSections, `${L.about} — ${brand}`),
    page('hizmetler', 'services', serviceSections, `${L.services} — ${brand}`),
    page('iletisim', 'contact', [headerBlock(0), contactBlock(1), footerBlock(2)], `${L.contact} — ${brand}`),
  ]
}
