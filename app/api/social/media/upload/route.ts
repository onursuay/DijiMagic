import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BUCKET = 'social-media'
const MAX_BYTES = 50 * 1024 * 1024 // 50MB (Vercel platform gövde limiti ayrıca geçerli)
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

  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Geçersiz form verisi' }, { status: 400 })
  }
  if (!file) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Dosya gerekli' }, { status: 400 })
  }

  const mime = file.type
  const ext = EXT_BY_MIME[mime]
  if (!ext) {
    return NextResponse.json({ ok: false, error: 'unsupported_type', message: 'Desteklenmeyen dosya türü' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'too_large', message: 'Dosya 50MB sınırını aşıyor' }, { status: 413 })
  }

  const path = `${access.user.id}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  })
  if (error) {
    console.error('[social.upload]', error.message)
    return NextResponse.json({ ok: false, error: 'upload_failed', message: 'Yükleme başarısız' }, { status: 500 })
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({
    ok: true,
    data: {
      storagePath: path,
      publicUrl: pub.publicUrl,
      mediaType: mime.startsWith('video/') ? 'video' : 'image',
    },
  })
}
