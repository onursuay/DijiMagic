import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meta/ads/preview?adId=...&format=...
 * Meta'nın GERÇEK reklam önizlemesi (WYSIWYG): /act_{id}/generatepreviews ile creative_id üzerinden
 * render edilmiş iframe HTML'i döner. Mevcut (yayınlanmış/taslak) reklamlar için kullanılır.
 *
 * Not: object_story_spec yerine creative_id kullanır → reklamın KAYITLI hâlini gösterir.
 * Önizleme alınamazsa (format desteklenmiyor, yetki vb.) 200 + body:null döner — UI hand-drawn'a düşer.
 */
const ALLOWED_FORMATS = new Set([
  'DESKTOP_FEED_STANDARD',
  'MOBILE_FEED_STANDARD',
  'INSTAGRAM_STANDARD',
  'INSTAGRAM_STORY',
  'FACEBOOK_STORY_MOBILE',
  'INSTAGRAM_REELS',
  'FACEBOOK_REELS_MOBILE',
  'MOBILE_FEED_BASIC',
  'RIGHT_COLUMN_STANDARD',
])

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const adId = (searchParams.get('adId') ?? '').trim()
    const formatParam = (searchParams.get('format') ?? 'MOBILE_FEED_STANDARD').trim()
    const adFormat = ALLOWED_FORMATS.has(formatParam) ? formatParam : 'MOBILE_FEED_STANDARD'

    if (!adId) {
      return NextResponse.json({ ok: false, error: 'missing_ad_id', message: 'adId zorunlu' }, { status: 400 })
    }

    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json({ ok: true, src: null, reason: 'no_context' })
    }

    // 1. Reklamın creative_id'sini çöz
    const adRes = await ctx.client.get<{ creative?: { id?: string } }>(`/${adId}`, { fields: 'creative{id}' })
    const creativeId = adRes.ok ? adRes.data?.creative?.id : undefined
    if (!creativeId) {
      return NextResponse.json({ ok: true, body: null, reason: 'no_creative_id' })
    }

    // 2. generatepreviews — render edilmiş iframe HTML
    const prevRes = await ctx.client.get<{ data?: Array<{ body?: string }> }>(
      `/${ctx.accountId}/generatepreviews`,
      { creative: JSON.stringify({ creative_id: creativeId }), ad_format: adFormat },
    )
    const body = prevRes.ok ? prevRes.data?.data?.[0]?.body ?? null : null
    // Güvenlik: ham HTML enjekte etmek yerine iframe src'sini çıkar; UI kontrollü <iframe> render eder.
    let src: string | null = null
    if (body) {
      const m = body.match(/src="([^"]+)"/i)
      if (m && m[1]) {
        const decoded = m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
        // Yalnız Facebook/Instagram önizleme alan adlarına izin ver
        if (/^https:\/\/(www\.)?(facebook|instagram)\.com\//i.test(decoded)) src = decoded
      }
    }
    return NextResponse.json({ ok: true, src, adFormat })
  } catch {
    // Önizleme kritik değil — hata olsa bile UI hand-drawn önizlemeye düşer
    return NextResponse.json({ ok: true, body: null, reason: 'error' })
  }
}
