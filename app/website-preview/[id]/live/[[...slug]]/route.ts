import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite, getPages } from '@/lib/website/store'
import { buildPreviewDocument } from '@/lib/website/render/servePreviewDocument'
import { SITE_CSP } from '@/lib/website/render/serveCommon'

export const dynamic = 'force-dynamic'

/**
 * #builder-7 — OWNER-GATED tam-sayfa TASLAK önizleme (DEV + her zaman erişilebilir).
 *
 * "Önizleme" butonu DEV'de (wildcard subdomain localhost'ta çözülmez) bunu yeni sekmede açar.
 * Çıplak (bare) birleştirilmiş TASLAK siteyi döndürür — sıkışık iframe DEĞİL, gerçek bir
 * üst-düzey sekme. Kapı: getCurrentUser + getWebsite(user.id, id) → yoksa 404 (sahip-özel).
 *
 * Çok-sayfalı nav: opsiyonel catch-all `[[...slug]]` ilk segmenti slug olarak okur
 * (/website-preview/<id>/live → home; /website-preview/<id>/live/<slug> → o sayfa).
 * .vercel.app HİÇBİR yerde görünmez; mevcut /website-preview iframe sayfası ve /s/ yayını bozulmaz.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; slug?: string[] } },
): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Not Found', { status: 404 })

  const website = await getWebsite(user.id, params.id)
  if (!website) return new NextResponse('Not Found', { status: 404 })

  const pages = await getPages(user.id, params.id)
  const lang = req.nextUrl.searchParams.get('lang') ?? req.nextUrl.searchParams.get('locale') ?? undefined
  const slug = params.slug?.[0]

  const { html, found } = await buildPreviewDocument({
    website,
    pages,
    // Nav 'path' → /website-preview/<id>/live/<slug> (bu catch-all'ı tekrar vurur).
    linkBase: `/website-preview/${params.id}/live`,
    lang,
    slug,
  })
  if (!found) return new NextResponse('Not Found', { status: 404 })

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'Content-Security-Policy': SITE_CSP,
      // Taslak önizleme — asla cache'lenmez, asla indekslenmez.
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
