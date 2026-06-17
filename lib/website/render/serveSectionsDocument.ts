import 'server-only'
import { createElement } from 'react'
import type { PublishedSite, WebsitePage } from '../types'
import SiteRenderer from './SiteRenderer'
import { compileSiteCss } from '../codegen/tailwindCompile'

/**
 * lib/website/render/serveSectionsDocument.ts
 *
 * `format='sections'` (eski/varsayılan) sayfaları, Route Handler dünyasında TAM bir
 * HTML belgesine çevirir. Route handler'lar layout'ları (kök `app/layout.tsx` + `(sites)/layout.tsx`)
 * BYPASS ettiği için, eskiden kök layout'tan gelen `<html><head><body>` iskeletini ve global
 * Tailwind stilini burada YENİDEN üretmek zorundayız.
 *
 * Eski belge neydi (page.tsx + layout dünyası):
 *   - Kök layout (app/layout.tsx, isPublicSite dalı): `<html lang={NEXT_LOCALE}><body class="inter… text-body">{children}</body></html>`
 *     + Next'in `generateMetadata`'dan ürettiği `<title>`/`<meta description>` + route'un derlenmiş
 *       global Tailwind/globals.css chunk'ı (SiteRenderer'ın tüm utility class'larını boyayan stil).
 *   - children = `<SiteRenderer page theme/>` → kök `<div>` (inline tema CSS değişkenleri + Google Fonts
 *       `<link>`'leri) içinde header/body/footer bölümleri.
 *
 * Faithful reproduction:
 *   1. `renderToStaticMarkup(<SiteRenderer/>)` ile bölüm markup'ını AYNEN string'e çevir
 *      (inline `style` tema değişkenleri + font `<link>`'leri markup'ta korunur).
 *   2. `compileSiteCss(markup, {})` ile markup'taki utility class'larından TAM olarak gereken
 *      Tailwind CSS'ini JIT derle (preflight base + kullanılan utilities). Bu, eskiden global
 *      stylesheet'in sağladığı boyamanın birebir karşılığıdır — ham `<select>`/dashboard class'ı
 *      kullanılmadığından (yalnız Tailwind utility + var(--site-*)) çıktı görsel olarak aynıdır.
 *      Tema değişkenleri SiteRenderer'ın kök div'inde inline taşındığından designVars boş ({}) verilir.
 *   3. `<!doctype html><html lang><head> charset+viewport+title+description </head><body>markup</body></html>`
 *      olarak sar. Inline `<style>` CSP `style-src 'unsafe-inline'` ile uyumludur.
 *
 * Not (CSP, mevcut davranış — DEĞİŞMEDİ): `/s/:path*` CSP'sinde `style-src 'self' 'unsafe-inline'`
 * cross-origin `fonts.googleapis.com` stylesheet'ini İÇERMEZ; SiteRenderer'ın Google Fonts `<link>`'i
 * eskiden de bloklanıp font-family değişkenindeki yerel yığına düşüyordu. Markup'ı aynen ürettiğimiz
 * için bu davranış birebir korunur (regresyon değil, mevcut durumun sadık kopyası).
 */

function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(str: string | null | undefined): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Bir sections sayfasını tam HTML belgesine çevirir (Route Handler için).
 *
 * @param page    Servis edilecek sayfa (format='sections')
 * @param site    Yayınlanmış site (tema + etiket; head başlığı/lang için)
 * @param locale  `<html lang>` (önceden seçilmiş locale)
 */
export async function renderSectionsDocument(
  page: WebsitePage,
  site: PublishedSite,
  locale: string,
): Promise<string> {
  // 1. SiteRenderer'ı (eskiden children olan ağaç) AYNEN string'e çevir.
  //    react-dom/server modül kapsamında import edilince Next.js statik analizi uyarı veriyor
  //    (Client Component guardrail); route handler salt-sunucu olduğundan runtime'da yüklüyoruz.
  const { renderToStaticMarkup } = await import('react-dom/server')
  const bodyMarkup = renderToStaticMarkup(
    createElement(SiteRenderer, { page, theme: site.website.theme }),
  )

  // 2. Markup'taki utility class'larından gereken Tailwind CSS'ini JIT derle.
  //    Tema değişkenleri SiteRenderer kök div'inde inline taşındığından :root designVars gerekmez.
  const css = await compileSiteCss(bodyMarkup, {})

  // 3. Head değerleri — eski generateMetadata ile aynı: title = seo.title || website.label.
  const safeLang = escapeAttr(locale || 'tr')
  const title = escapeHtml(page.seo?.title || site.website.label || 'Site')
  const desc = page.seo?.description ? escapeAttr(page.seo.description) : ''
  const descMeta = desc ? `<meta name="description" content="${desc}">\n    ` : ''

  return `<!doctype html>
<html lang="${safeLang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    ${descMeta}<style>
${css}
    </style>
  </head>
  <body>${bodyMarkup}</body>
</html>`
}
