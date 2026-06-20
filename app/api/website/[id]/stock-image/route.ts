import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite } from '@/lib/website/store'
import { pickStockImage, isStockReady } from '@/lib/website/stock'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * GET /api/website/[id]/stock-image?q=...
 *
 * Owner-gated wrapper over the EXISTING stock resolver — returns ONE image URL for
 * the query (the same provider chain the full-page generator uses: Freepik → Pexels
 * → Unsplash → Pixabay). Used by the manual "Görseli değiştir → Açıklama ile bul"
 * action. The URL is fed into the deterministic `replace_image` patch, whose own
 * validator only accepts absolute https URLs (provider URLs are https).
 *
 * Security:
 *   - getCurrentUser + getWebsite(user.id, id) → 404 if the site isn't theirs.
 *   - q is trimmed + length-capped; only the resolved provider URL is returned (we
 *     never echo arbitrary input). If the URL isn't https it is dropped (defensive).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

  const site = await getWebsite(user.id, params.id)
  if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 120)
  if (!q) return NextResponse.json({ ok: false, error: 'Açıklama gerekli' }, { status: 400 })

  if (!isStockReady()) {
    return NextResponse.json({ ok: false, error: 'Görsel sağlayıcı yapılandırılmamış' }, { status: 503 })
  }

  try {
    const img = await pickStockImage(q)
    const url = typeof img?.url === 'string' ? img.url.trim() : ''
    // Only an absolute https URL is usable by the replace_image validator.
    if (!url || !/^https:\/\//i.test(url)) {
      return NextResponse.json({ ok: false, error: 'Bu açıklama için görsel bulunamadı' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, url, alt: img?.alt ?? null })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Görsel alınamadı'
    console.error('[website:stock-image]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
