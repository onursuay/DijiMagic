import { NextResponse, type NextRequest } from 'next/server'
import { getPublishedSiteBySubdomain } from '@/lib/website/store'
import { assembleDocument } from '@/lib/website/codegen/assembleDocument'
import { themeToDesignVars } from '@/lib/website/render/designVars'
import { renderSectionsDocument } from '@/lib/website/render/serveSectionsDocument'
import { pickLocale, findHomePage, collectKnownSlugs, SITE_CSP } from '@/lib/website/render/serveCommon'

export const dynamic = 'force-dynamic'

/**
 * PUBLIC anasayfa servisi — birleşik Route Handler (dual-read: format='html' | 'sections').
 *
 * Eskiden bu yol `page.tsx` + `<SiteRenderer/>` idi; kök layout `<html><head><body>` iskeletini
 * sağlıyordu. Route handler layout'ları bypass ettiğinden TAM belgeyi burada üretiyoruz:
 *   - format='html'     → assembleDocument (Task 8) tam belge döndürür (codegen).
 *   - format='sections' → SiteRenderer renderToStaticMarkup ile string'e çevrilip eski belgeye
 *                          birebir sarılır (renderSectionsDocument). Mevcut yayınlanmış siteler
 *                          (hepsi format='sections') görsel olarak DEĞİŞMEZ.
 *
 * Subdomain + locale + sayfa seçimi eski page.tsx ile birebir; 404 davranışı korunur (notFound →
 * 404 NextResponse). force-dynamic korunur.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { subdomain: string } },
): Promise<NextResponse> {
  const site = await getPublishedSiteBySubdomain(params.subdomain)
  if (!site) return new NextResponse('Not Found', { status: 404 })

  const lang = req.nextUrl.searchParams.get('lang') ?? undefined
  const locale = pickLocale(site.website.locales, site.website.defaultLocale, lang)

  const home = findHomePage(site, locale)
  if (!home) return new NextResponse('Not Found', { status: 404 })

  const headers: Record<string, string> = {
    'content-type': 'text/html; charset=utf-8',
    'Content-Security-Policy': SITE_CSP,
  }

  if (home.format === 'html') {
    const html = await assembleDocument({
      bodyHtml: home.html ?? '',
      designVars: themeToDesignVars(site.website.theme),
      seo: home.seo ?? {},
      lang: locale,
      fontHref: site.website.theme?.fontHref ?? null,
      mode: 'serve',
      // MULTIPAGE nav: rewrite data-yoai-href="<slug>" → /s/<subdomain>[/<slug>].
      // Landing (single-page) html has no data-yoai-href → no-op. Custom-domain
      // base differs (root vs /s/<sub>) — see lib/website/codegen TODO; subdomain
      // serving is the reliable path implemented here.
      linkBase: `/s/${params.subdomain}`,
      navMode: 'path',
      // SLUG-SET-AWARE: nav links to a page that does not exist resolve to the
      // home base (/s/<sub>) instead of 404ing on /s/<sub>/<missing-slug>.
      knownSlugs: collectKnownSlugs(site),
    })
    return new NextResponse(html, { headers })
  }

  // format='sections' (varsayılan) — eski belgeye birebir sadık.
  const html = await renderSectionsDocument(home, site, locale)
  return new NextResponse(html, { headers })
}
