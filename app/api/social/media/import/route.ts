/**
 * POST /api/social/media/import
 * Tasarım kütüphanesindeki (fal.ai CDN) bir görseli/videoyu social-media bucket'a
 * kopyalar. SSRF koruması: yalnız fal CDN host'larından + https indirilir.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BUCKET = 'social-media'
const FAL_HOSTS = ['fal.media', 'fal.ai', 'fal.run']

function isFalUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && FAL_HOSTS.some((h) => u.host === h || u.host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'storage_unavailable', message: 'Depolama kullanılamıyor' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({} as any))
  const sourceUrl = typeof body?.sourceUrl === 'string' ? body.sourceUrl : ''
  const expectedType: 'image' | 'video' | null =
    body?.mediaType === 'video' ? 'video' : body?.mediaType === 'image' ? 'image' : null
  if (!isFalUrl(sourceUrl)) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Geçersiz kaynak' }, { status: 400 })
  }

  let buffer: Buffer
  let contentType: string
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(60000) })
    if (!res.ok) throw new Error(`fetch ${res.status}`)
    buffer = Buffer.from(await res.arrayBuffer())
    contentType = res.headers.get('content-type') || ''
  } catch {
    return NextResponse.json({ ok: false, error: 'fetch_failed', message: 'İçerik alınamadı' }, { status: 502 })
  }

  // Tür belirleme: content-type > URL uzantısı > client beklentisi. Hiçbiri yoksa reddet
  // (video'nun sessizce .jpg olarak yatmasını önler).
  const ctImage = contentType.startsWith('image/')
  const ctVideo = contentType.startsWith('video/')
  const urlExt = (() => { try { return (new URL(sourceUrl).pathname.split('.').pop() || '').toLowerCase() } catch { return '' } })()
  const urlImage = ['jpg', 'jpeg', 'png', 'webp'].includes(urlExt)
  const urlVideo = ['mp4', 'mov'].includes(urlExt)
  let isVideo: boolean
  if (ctImage || ctVideo) isVideo = ctVideo
  else if (urlImage || urlVideo) isVideo = urlVideo
  else if (expectedType) isVideo = expectedType === 'video'
  else return NextResponse.json({ ok: false, error: 'unknown_type', message: 'Medya türü belirlenemedi' }, { status: 415 })
  const ext = isVideo
    ? 'mp4'
    : contentType.includes('png') || urlExt === 'png' ? 'png'
    : contentType.includes('webp') || urlExt === 'webp' ? 'webp' : 'jpg'
  const path = `${access.user.id}/${randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: contentType || (isVideo ? 'video/mp4' : 'image/jpeg'),
    upsert: false,
  })
  if (error) {
    console.error('[social.media.import]', error.message)
    return NextResponse.json({ ok: false, error: 'upload_failed', message: 'Aktarılamadı' }, { status: 500 })
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({
    ok: true,
    data: { storagePath: path, publicUrl: pub.publicUrl, mediaType: isVideo ? 'video' : 'image' },
  })
}
