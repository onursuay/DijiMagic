import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite, ensurePreviewToken } from '@/lib/website/store'

export const dynamic = 'force-dynamic'

/**
 * #builder-7 — GET /api/website/[id]/preview-url (OWNER-GATED)
 *
 * "Önizleme" butonunun yeni sekmede açacağı tam-sayfa TASLAK önizleme URL'ini döner:
 *   - PROD + WEBSITE_PREVIEW_DOMAIN==='1' + PREVIEW_ROOT_DOMAIN tanımlıysa →
 *       markalı `https://<token>.<root>` (token tahmin-edilemez; theme'e yazılır).
 *   - Aksi halde (DEV varsayılan) → owner-gated path `/website-preview/<id>/live`.
 *
 * .vercel.app HİÇBİR koşulda dönmez (panelde/butonda/URL'de gizli kalır).
 * Yanıt: { ok, url, mode: 'branded'|'owner' }.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const site = await getWebsite(user.id, params.id)
    if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })

    const root = (process.env.PREVIEW_ROOT_DOMAIN || '').trim().toLowerCase()
    const branded = process.env.WEBSITE_PREVIEW_DOMAIN === '1' && !!root

    if (branded) {
      // Token'ı üret/al (yoksa şimdi üretilir; migration yok). Markalı host = <token>.<root>.
      const token = await ensurePreviewToken(user.id, params.id)
      if (token) {
        return NextResponse.json({ ok: true, mode: 'branded', url: `https://${token}.${root}` })
      }
      // Token üretilemediyse (ör. site yok) → güvenli owner-gated path'e düş.
    }

    // DEV / flag-off → owner oturumuyla açılan tam-sayfa path önizlemesi (.vercel.app YOK).
    return NextResponse.json({ ok: true, mode: 'owner', url: `/website-preview/${params.id}/live` })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
