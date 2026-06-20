/**
 * POST /api/social/media/sign-upload
 * Tarayıcının dosyayı DOĞRUDAN Supabase Storage'a yüklemesi için imzalı URL üretir.
 * Vercel Route Handler ~4.5MB gövde limitini bypass eder (büyük video yüklemesi için).
 * Sunucu yalnız path + imza üretir; dosya gövdesi sunucudan geçmez.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

const BUCKET = 'social-media'
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
}

export async function POST(req: NextRequest) {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'storage_unavailable', message: 'Depolama kullanılamıyor' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({} as any))
  const contentType = typeof body?.contentType === 'string' ? body.contentType : ''
  const ext = EXT_BY_MIME[contentType]
  if (!ext) {
    return NextResponse.json({ ok: false, error: 'unsupported_type', message: 'Desteklenmeyen dosya türü' }, { status: 415 })
  }

  const path = `${access.user.id}/${randomUUID()}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[social.sign-upload]', error?.message)
    return NextResponse.json({ ok: false, error: 'sign_failed', message: 'Yükleme bağlantısı oluşturulamadı' }, { status: 500 })
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({
    ok: true,
    data: {
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath: path,
      publicUrl: pub.publicUrl,
      mediaType: contentType.startsWith('video/') ? 'video' : 'image',
    },
  })
}
