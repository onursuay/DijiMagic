import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/edge-config'

/** Uygulamanın kendi host'ları — bunlar ASLA custom-domain olarak yönlendirilmez. */
const APP_HOST = 'dijimagic.com'

/**
 * EN slug → TR filesystem slug (app routes only).
 * Legal pages (privacy-policy, terms, etc.) are NOT here because
 * they have their own filesystem routes under /privacy-policy, /terms, etc.
 */
const EN_TO_TR: Record<string, string> = {
  'strategy': 'strateji',
  'optimization': 'optimizasyon',
  'target-audience': 'hedef-kitle',
  'design': 'tasarim',
  'reports': 'raporlar',
  'integration': 'entegrasyon',
  'dijialgorithm': 'dijialgoritma',
  'subscription': 'abonelik',
  'account': 'hesabim',
  'invoices': 'faturalarim',
  'terms-of-service': 'terms',
  'pricing': 'fiyatlandirma',
  'conversion-wizard': 'donusum-sihirbazi',
  'crm-system': 'crm-sistemi',
  'business-profile': 'isletme-profili',
  'help-center': 'yardim-merkezi',
}

/** TR slug → EN slug (for redirect when locale=en on TR URL) */
const TR_TO_EN: Record<string, string> = {
  'strateji': 'strategy',
  'optimizasyon': 'optimization',
  'hedef-kitle': 'target-audience',
  'tasarim': 'design',
  'raporlar': 'reports',
  'entegrasyon': 'integration',
  'dijialgoritma': 'dijialgorithm',
  'abonelik': 'subscription',
  'hesabim': 'account',
  'faturalarim': 'invoices',
  'gizlilik-politikasi': 'privacy-policy',
  'cerez-politikasi': 'cookie-policy',
  'kullanim-kosullari': 'terms-of-service',
  'veri-silme': 'data-deletion',
  'fiyatlandirma': 'pricing',
  'donusum-sihirbazi': 'conversion-wizard',
  'crm-sistemi': 'crm-system',
  'isletme-profili': 'business-profile',
  'yardim-merkezi': 'help-center',
}

/** All app slugs that need /en/ prefix when locale=en (includes same-slug routes) */
const APP_SLUGS = new Set([
  ...Object.keys(TR_TO_EN),
  'meta-ads', 'google-ads', 'tiktok-ads', 'seo-plus', 'dashboard',
  'email-marketing',
])

/**
 * Public legal/marketing pages (privacy, terms, cookie, data-deletion) — both
 * EN and TR slugs. These must look like public, crawlable static documents to
 * external validators (Google OAuth verification, search engines): the app's
 * default `private, no-store` Cache-Control (forced by cookies() in the root
 * layout) makes them look like authenticated/dynamic pages. We override that
 * here so the page is served as a public web document.
 */
const PUBLIC_LEGAL_SLUGS = new Set([
  'privacy-policy', 'gizlilik-politikasi',
  'terms', 'terms-of-service', 'kullanim-kosullari',
  'cookie-policy', 'cerez-politikasi',
  'data-deletion', 'veri-silme',
])

/** Mark a response as a public, crawlable web document. */
function applyPublicLegalHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=86400, must-revalidate')
  response.headers.set('X-Robots-Tag', 'index, follow')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 0. Faz 3 — custom domain yönlendirme. DEFAULT-OFF flag: flag kapalıyken bu blok hiç çalışmaz
  // → davranış bugünküyle BİREBİR aynı (canlıya sıfır risk). Açıkken yalnız Edge Config'te kayıtlı
  // (cd_<host>) custom domain host'ları ilgili siteye yönlendirilir; dashboard host'u hariç + eşlemesi yok.
  if (process.env.WEBSITE_CUSTOM_DOMAINS === '1') {
    const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
    if (host && host !== APP_HOST && !host.endsWith('.vercel.app') && host !== 'localhost' && host !== '127.0.0.1') {
      try {
        const sub = await get<string>('cd_' + host.replace(/[^a-z0-9]/g, '_'))
        if (sub) {
          const url = request.nextUrl.clone()
          const rewrittenPathname = `/s/${sub}${pathname === '/' ? '' : pathname}`
          url.pathname = rewrittenPathname
          const reqHeaders = new Headers(request.headers)
          reqHeaders.set('x-pathname', rewrittenPathname)
          return NextResponse.rewrite(url, { request: { headers: reqHeaders } })
        }
      } catch {
        /* Edge Config yok/erişilemedi → normal akışa düş */
      }
    }
  }

  // 1. Handle /en prefix: rewrite to TR filesystem route + set locale
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const rest = pathname.slice(3) || '/' // strip '/en'

    let rewritePath = rest
    if (rest !== '/') {
      const segments = rest.split('/')
      if (segments.length >= 2 && segments[1]) {
        const enSlug = segments[1]
        const trSlug = EN_TO_TR[enSlug] || enSlug
        segments[1] = trSlug
        rewritePath = segments.join('/')
      }
    }

    // Set locale on request (for SSR) and response (for browser)
    request.cookies.set('NEXT_LOCALE', 'en')
    const url = request.nextUrl.clone()
    url.pathname = rewritePath
    const reqHeadersEn = new Headers(request.headers)
    reqHeadersEn.set('x-pathname', rewritePath)
    const response = NextResponse.rewrite(url, { request: { headers: reqHeadersEn } })
    response.cookies.set('NEXT_LOCALE', 'en', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    if (PUBLIC_LEGAL_SLUGS.has(rest.split('/')[1] || '')) {
      applyPublicLegalHeaders(response)
    }
    return response
  }

  // 2. If locale=en but user is on a non-/en/ URL → redirect to /en/ equivalent
  const locale = request.cookies.get('NEXT_LOCALE')?.value
  if (locale === 'en') {
    // Homepage: / → /en
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/en'
      return NextResponse.redirect(url)
    }
    // App routes: /strateji → /en/strategy, /meta-ads → /en/meta-ads
    const firstSlug = pathname.split('/')[1]
    if (firstSlug && APP_SLUGS.has(firstSlug)) {
      const enSlug = TR_TO_EN[firstSlug] || firstSlug
      const rest = pathname.slice(firstSlug.length + 1)
      const url = request.nextUrl.clone()
      url.pathname = `/en/${enSlug}${rest}`
      return NextResponse.redirect(url)
    }
  }

  // 3. Default: ensure NEXT_LOCALE cookie exists
  const reqHeadersDefault = new Headers(request.headers)
  reqHeadersDefault.set('x-pathname', pathname)
  const response = NextResponse.next({ request: { headers: reqHeadersDefault } })
  if (!request.cookies.get('NEXT_LOCALE')) {
    response.cookies.set('NEXT_LOCALE', locale || 'tr', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  if (PUBLIC_LEGAL_SLUGS.has(pathname.split('/')[1] || '')) {
    applyPublicLegalHeaders(response)
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
