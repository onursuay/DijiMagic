import { NextResponse, type NextRequest } from 'next/server'
import { findWebsiteByPreviewToken } from '@/lib/website/store'
import { buildPreviewDocument } from '@/lib/website/render/servePreviewDocument'
import { SITE_CSP } from '@/lib/website/render/serveCommon'

export const dynamic = 'force-dynamic'

/**
 * #builder-7 — TOKEN-GATED markalı tam-sayfa TASLAK önizleme (PROD, flag-gated).
 *
 * PUBLIC yol değildir: middleware `<token>.preview.<root>` host'unu bu route'a REWRITE eder
 * (WEBSITE_PREVIEW_DOMAIN==='1' açıkken). Kapı = TOKEN (160-bit, tahmin-edilemez) → dashboard
 * oturumu GEREKMEZ; sahip linki ziyaretçi gibi açabilir. Token eşleşmezse 404.
 *
 * Çıplak (bare) birleştirilmiş TASLAK siteyi döndürür (yayınlanmamış dahil) — /s/ yayını DEĞİL.
 * .vercel.app asla görünmez; çıktı SITE_CSP + noindex ile servis edilir.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string; slug?: string[] } },
): Promise<NextResponse> {
  const site = await findWebsiteByPreviewToken(params.token)
  if (!site) return new NextResponse('Not Found', { status: 404 })

  const lang = req.nextUrl.searchParams.get('lang') ?? undefined
  const slug = params.slug?.[0]

  const { html, found } = await buildPreviewDocument({
    website: site.website,
    pages: site.pages,
    // Nav 'path' + HOST-KÖK taban ('/') → home '/' , slug '/<slug>'. Tarayıcıda host
    // <token>.preview.<root> SABİT kalır; middleware '/<slug>' → '/site-preview/<token>/<slug>'
    // rewrite eder. İç route yolu (.../site-preview/...) URL çubuğunda ASLA görünmez.
    linkBase: '/',
    lang,
    slug,
  })
  if (!found) return new NextResponse('Not Found', { status: 404 })

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'Content-Security-Policy': SITE_CSP,
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
