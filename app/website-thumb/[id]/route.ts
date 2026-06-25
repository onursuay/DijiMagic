import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite, getPages } from '@/lib/website/store'
import { assembleDocument } from '@/lib/website/codegen/assembleDocument'
import { themeToDesignVars } from '@/lib/website/render/designVars'
import { renderSectionsDocument } from '@/lib/website/render/serveSectionsDocument'
import { pickLocale, findHomePage, collectKnownSlugs, SITE_CSP } from '@/lib/website/render/serveCommon'
import type { PublishedSite, WebsitePage } from '@/lib/website/types'

export const dynamic = 'force-dynamic'

/**
 * app/website-thumb/[id]/route.ts
 *
 * SAHİP-ÖZEL, CHROME'SUZ ANASAYFA ÖNİZLEME (thumbnail) — Web Site Yöneticisi liste
 * kartlarının içinde küçültülmüş canlı `<iframe>` olarak gömülür.
 *
 * Neden ayrı bir Route Handler (yeni belge assembly DEĞİL — mevcut reuse):
 *   - Public `/s/<altalan>` yalnız YAYINLANMIŞ sitelerde çalışır; taslak (unpublished)
 *     siteler orada 404 verir. Liste kartı taslakları da göstermek zorunda → bu yol
 *     `getPages` ile TASLAK sayfaları okur (tıpkı `/website-preview/[id]` gibi).
 *   - Modül layout'unu (sidebar/topbar) BYPASS eder → kartta yalnız sitenin kendi
 *     anasayfası görünür, dashboard chrome'u değil.
 *
 * Belge montajı TEK KAYNAKTAN tekrar kullanılır (kopya YOK):
 *   - format='html'     → assembleDocument(... mode:'serve')  [/s/ ile birebir]
 *   - format='sections' → renderSectionsDocument(...)         [/s/ ile birebir]
 * Sonra thumbnail'e özel iki hafif post-process uygulanır (assembleDocument'e dokunmadan):
 *   1. Reveal nötrleme: küçük, kaydırılmayan kutuda alt bölümler IntersectionObserver
 *      tetiklenmediği için gizli kalır → `[data-dijimagic-reveal]` görünür yapılır (settled state).
 *   2. Runtime sökme: kartta etkileşim yok → `/dijimagic-site-runtime.js` script'i kaldırılır
 *      (gereksiz animasyon/motion thumbnail'i bozmasın). sections sitelerinde runtime zaten yok.
 *
 * İZOLASYON: yanıta `/s/` ile AYNI `SITE_CSP` yazılır (defense-in-depth). Kart `<iframe>`'i
 * `sandbox="allow-scripts"` kullanır — `allow-same-origin` YOK → opak origin, üst pencereye
 * erişemez. CSP `script-src 'self'` + `frame-ancestors 'self'` ile birlikte izolasyon korunur.
 */

/** Thumbnail'e özel head enjeksiyonu: reveal'i kalıcı görünür yapan stil (motion yok). */
const THUMB_HEAD_STYLE =
  '<style>[data-dijimagic-reveal]{opacity:1!important;transform:none!important;transition:none!important}' +
  '*{animation:none!important}</style>'

/** Runtime script tag'lerini söker (serve: external; preview: inline) — thumbnail etkileşimsizdir. */
function stripRuntime(html: string): string {
  return html
    .replace(/<script[^>]*src=["']\/dijimagic-site-runtime\.js["'][^>]*><\/script>/gi, '')
    .replace(/<script>[\s\S]*?dijimagic-site-runtime[\s\S]*?<\/script>/gi, '')
}

/** Thumbnail post-process: reveal stilini head'e ekle + runtime'ı sök. */
function toThumbDocument(html: string): string {
  const withStyle = html.includes('</head>')
    ? html.replace('</head>', `${THUMB_HEAD_STYLE}</head>`)
    : `${THUMB_HEAD_STYLE}${html}`
  return stripRuntime(withStyle)
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  // Sahiplik kontrolü — önizleme ile birebir (kullanıcı kendi sitesini görür).
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Not Found', { status: 404 })

  const site = await getWebsite(user.id, params.id)
  if (!site) return new NextResponse('Not Found', { status: 404 })

  const pages = await getPages(user.id, params.id)
  const lang = req.nextUrl.searchParams.get('locale') ?? undefined
  const locale = pickLocale(site.locales, site.defaultLocale, lang)

  // PublishedSite şekli — sections render + slug toplama yardımcıları bunu bekler
  // (TASLAK sayfalardan inşa edilir; yayın gerekmez).
  const published: PublishedSite = { website: site, pages }
  const home: WebsitePage | undefined = findHomePage(published, locale)

  if (!home) {
    // İçerik yoksa boş, sade bir belge döndür (kart yine de düzgün görünsün).
    const empty =
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>html,body{margin:0;height:100%;background:#f9fafb}</style></head><body></body></html>'
    return new NextResponse(empty, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'Content-Security-Policy': SITE_CSP },
    })
  }

  const headers: Record<string, string> = {
    'content-type': 'text/html; charset=utf-8',
    'Content-Security-Policy': SITE_CSP,
    // Önbellek: kart yeniden açıldığında hızlı; revizyon/yayın değişimi force-dynamic ile tazelenir.
    'Cache-Control': 'private, max-age=0, must-revalidate',
  }

  if (home.format === 'html') {
    const doc = await assembleDocument({
      bodyHtml: home.html ?? '',
      designVars: themeToDesignVars(site.theme),
      seo: home.seo ?? {},
      lang: locale,
      fontHref: site.theme?.fontHref ?? null,
      mode: 'serve',
      // Nav rewrite — kartta tıklama yok ama href'ler tutarlı kalsın (anasayfa tabanı).
      linkBase: `/website-thumb/${params.id}`,
      navMode: 'path',
      knownSlugs: collectKnownSlugs(published),
    })
    return new NextResponse(toThumbDocument(doc), { headers })
  }

  // format='sections' (varsayılan) — /s/ ile aynı reproduction; reveal/runtime kullanmaz.
  const doc = await renderSectionsDocument(home, published, locale)
  return new NextResponse(toThumbDocument(doc), { headers })
}
