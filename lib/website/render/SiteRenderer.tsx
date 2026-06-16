import type { CSSProperties } from 'react'
import type { WebsitePage, ThemeTokens, SectionBlock } from '../types'
import { themeToCssVars, fontHrefFor } from './theme'
import { renderSection } from './sections'

interface SiteRendererProps {
  page: WebsitePage
  theme: ThemeTokens | null | undefined
  /** Önizleme kapsayıcısında kullanım için ek stil. */
  style?: CSSProperties
  /**
   * Önizleme (taslak) modunda site ID'si. Verilirse `/s/<altalan>/...` (yayın) menü/CTA linkleri
   * `/website-preview/<id>?slug=...&locale=...`'a çevrilir → taslak yayınlanmadan menü 404 vermez.
   * Yayın (`/s/`) render'ında verilmez; gerçek yayın linkleri kullanılır.
   */
  previewId?: string
}

/** `/s/<altalan>[/<slug>]` → önizleme linki (locale korunur). Anchor (#) / dış (http) dokunulmaz. */
function toPreviewHref(href: unknown, previewId: string, locale: string | undefined): unknown {
  if (typeof href !== 'string' || !href.startsWith('/s/')) return href
  const parts = href.split('/').filter(Boolean) // ['s', '<altalan>', '<slug>?']
  const slug = parts.length >= 3 ? parts[parts.length - 1] : 'home'
  const loc = locale ? `&locale=${encodeURIComponent(locale)}` : ''
  return `/website-preview/${previewId}?slug=${slug}${loc}`
}

/** Önizleme modunda iç (yayın) menü/CTA/logo linklerini iframe-içi gezinmeye çevirir. */
function applyPreviewLinks(sections: SectionBlock[], previewId: string, locale: string | undefined): SectionBlock[] {
  const tp = (h: unknown) => toPreviewHref(h, previewId, locale)
  return sections.map((b) => {
    const c = { ...(b.content ?? {}) } as Record<string, unknown>
    if (Array.isArray(c.nav)) c.nav = (c.nav as Record<string, unknown>[]).map((n) => ({ ...n, href: tp(n.href) }))
    if (Array.isArray(c.serviceLinks)) c.serviceLinks = (c.serviceLinks as Record<string, unknown>[]).map((n) => ({ ...n, href: tp(n.href) }))
    if (typeof c.ctaHref === 'string') c.ctaHref = tp(c.ctaHref)
    if (typeof c.secondaryCtaHref === 'string') c.secondaryCtaHref = tp(c.secondaryCtaHref)
    if (typeof c.homeHref === 'string') c.homeHref = tp(c.homeHref)
    return { ...b, content: c }
  })
}

/** Tek bir sayfa modelini tema + yazı ailesi uygulayarak render eder. */
export default function SiteRenderer({ page, theme, style, previewId }: SiteRendererProps) {
  // Logo → header/footer; iletişim formuna websiteId + locale (etiket fallback) RENDER anında enjekte edilir.
  const logoUrl = theme?.logoUrl
  let sections: SectionBlock[] = page.sections.map((b) => {
    if ((b.type === 'header' || b.type === 'footer') && logoUrl) {
      const existing = (b.content as Record<string, unknown> | undefined)?.logoUrl
      return { ...b, content: { ...b.content, logoUrl: existing || logoUrl } }
    }
    if (b.type === 'contact') {
      return { ...b, content: { ...b.content, websiteId: page.websiteId, locale: page.locale } }
    }
    return b
  })
  if (previewId) sections = applyPreviewLinks(sections, previewId, page.locale)

  return (
    <div
      style={{ ...themeToCssVars(theme), fontFamily: 'var(--site-font-body)', ...style }}
      className="bg-white text-black antialiased"
    >
      {/* Üretilen sitenin yazı aileleri — yalnız bu sitenin fontları (Next head'e hoist eder) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={fontHrefFor(theme)} />
      {sections.map((block, i) => renderSection(block, i))}
    </div>
  )
}
