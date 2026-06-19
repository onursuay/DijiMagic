import 'server-only'
import { assembleDocument } from '@/lib/website/codegen/assembleDocument'
import { themeToDesignVars } from '@/lib/website/render/designVars'
import { renderSectionsDocument } from '@/lib/website/render/serveSectionsDocument'
import { pickLocale, findHomePage, findPageBySlug, collectKnownSlugs } from '@/lib/website/render/serveCommon'
import type { Website, WebsitePage, PublishedSite } from '@/lib/website/types'

/**
 * lib/website/render/servePreviewDocument.ts (#builder-7)
 *
 * Markalı YENİ-SEKME TASLAK önizlemesi — sıkışık dashboard iframe'i DEĞİL, gerçek bir
 * üst-düzey sekmede servis edilen ÇIPLAK (bare) tam belge. İki erişim modu bunu paylaşır:
 *   - Owner-gated path  (DEV + her zaman): /website-preview/<id>/live (getCurrentUser kapısı)
 *   - Token-gated brand (PROD, flag):      <token>.preview.<root>  (token = kapı)
 *
 * Her ikisi de TASLAK sayfaları (yayınlanmamış dahil) `mode:'serve'` ile birleştirir →
 * harici runtime (script-src 'self') + same-origin (üst-düzey sekme) çalışır, /s/ yayın
 * akışı DEĞİŞMEZ. Çıktı SITE_CSP başlığıyla (XSS yok) servis edilir.
 */

export interface PreviewDocResult {
  html: string
  /** Bu locale/slug için sayfa bulunamadıysa false (404). */
  found: boolean
}

/**
 * TASLAK önizleme belgesini üretir. linkBase çağıran route'a göre verilir; nav 'path'
 * modundadır (üst-düzey sekme → gerçek URL'ler), böylece çok-sayfalı gezinme önizleme
 * içinde kalır. Contact form'u önizlemede OPTIMISTIC (formActionBase verilmez → gerçek
 * gönderim yok; /s/ yayınında gerçek lead gönderilir).
 */
export async function buildPreviewDocument(args: {
  website: Website
  pages: WebsitePage[]
  /** Önizleme nav/route tabanı, ör. '/website-preview/<id>/live' veya '/_preview/<token>'. */
  linkBase: string
  lang?: string
  slug?: string
}): Promise<PreviewDocResult> {
  const { website, pages, linkBase } = args
  const locale = pickLocale(website.locales, website.defaultLocale, args.lang)

  // PublishedSite şekli serveCommon yardımcıları için yeniden kullanılır (taslak sayfalarla).
  const siteShape: PublishedSite = { website, pages }
  const page: WebsitePage | undefined = args.slug
    ? findPageBySlug(siteShape, args.slug, locale)
    : findHomePage(siteShape, locale)

  if (!page) return { html: '', found: false }

  if (page.format === 'html') {
    const html = await assembleDocument({
      bodyHtml: page.html ?? '',
      designVars: themeToDesignVars(website.theme),
      seo: page.seo ?? {},
      lang: locale,
      fontHref: website.theme?.fontHref ?? null,
      // serve: harici runtime + same-origin (üst-düzey sekme) → preview srcdoc'tan farklı,
      // gerçek bir sayfa gibi davranır; CSP script-src 'self' ile runtime yüklenir.
      mode: 'serve',
      // MULTIPAGE nav: data-yoai-href="<slug>" → <linkBase>/<slug>. Bilinmeyen slug → taban.
      linkBase,
      navMode: 'path',
      knownSlugs: collectKnownSlugs(siteShape),
      // formActionBase KASITLI verilmez → contact form önizlemede optimistic (gerçek lead yok).
    })
    return { html, found: true }
  }

  // format='sections' — yayın belgesiyle birebir aynı sarmalama (regresyon yok).
  const html = await renderSectionsDocument(page, siteShape, locale)
  return { html, found: true }
}
