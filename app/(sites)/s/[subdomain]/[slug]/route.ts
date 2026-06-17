import { NextResponse, type NextRequest } from 'next/server'
import { getPublishedSiteBySubdomain } from '@/lib/website/store'
import { assembleDocument } from '@/lib/website/codegen/assembleDocument'
import { themeToDesignVars } from '@/lib/website/render/designVars'
import { renderSectionsDocument } from '@/lib/website/render/serveSectionsDocument'
import { pickLocale, findPageBySlug, SITE_CSP } from '@/lib/website/render/serveCommon'

export const dynamic = 'force-dynamic'

/**
 * PUBLIC slug sayfa servisi — birleşik Route Handler (dual-read: format='html' | 'sections').
 *
 * Anasayfa route'u ile aynı mimari: layout bypass edildiğinden TAM belgeyi burada üretiyoruz.
 *   - format='html'     → assembleDocument (Task 8).
 *   - format='sections' → SiteRenderer markup'ı eski belgeye birebir sarılır (regresyon yok).
 *
 * Subdomain + locale + slug seçimi eski page.tsx ile birebir; 404 (notFound → 404 NextResponse)
 * ve force-dynamic korunur.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { subdomain: string; slug: string } },
): Promise<NextResponse> {
  const site = await getPublishedSiteBySubdomain(params.subdomain)
  if (!site) return new NextResponse('Not Found', { status: 404 })

  const lang = req.nextUrl.searchParams.get('lang') ?? undefined
  const locale = pickLocale(site.website.locales, site.website.defaultLocale, lang)

  const page = findPageBySlug(site, params.slug, locale)
  if (!page) return new NextResponse('Not Found', { status: 404 })

  const headers: Record<string, string> = {
    'content-type': 'text/html; charset=utf-8',
    'Content-Security-Policy': SITE_CSP,
  }

  if (page.format === 'html') {
    const html = await assembleDocument({
      bodyHtml: page.html ?? '',
      designVars: themeToDesignVars(site.website.theme),
      seo: page.seo ?? {},
      lang: locale,
      fontHref: site.website.theme?.fontHref ?? null,
      mode: 'serve',
    })
    return new NextResponse(html, { headers })
  }

  // format='sections' (varsayılan) — eski belgeye birebir sadık.
  const html = await renderSectionsDocument(page, site, locale)
  return new NextResponse(html, { headers })
}
