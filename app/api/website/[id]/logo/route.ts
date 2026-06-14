import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite, updateWebsite } from '@/lib/website/store'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

const BUCKET = 'website-logos'
const MAX_BYTES = 2 * 1024 * 1024 // 2MB

async function ensureBucket() {
  if (!supabase) return
  try {
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES })
  } catch {
    /* zaten var → yok say */
  }
}

// SVG KASITEN HARİÇ: gömülü <script> ile stored-XSS riski. Logo için raster yeterli.
const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp',
}

/** Logo yükle → Supabase Storage → public URL → website.theme.logoUrl (mevcut tema korunur). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  if (!supabase) return NextResponse.json({ ok: false, error: 'Storage yapılandırılmamış' }, { status: 500 })
  try {
    const site = await getWebsite(user.id, params.id)
    if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'Dosya gerekli' }, { status: 400 })
    if (!file.type.startsWith('image/') || !EXT[file.type]) {
      return NextResponse.json({ ok: false, error: 'Yalnız PNG/JPG/WEBP/SVG görsel' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'En fazla 2MB' }, { status: 400 })

    await ensureBucket()
    const buf = Buffer.from(await file.arrayBuffer())
    const path = `${user.id}/${params.id}-${Date.now()}.${EXT[file.type]}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type,
      upsert: true,
    })
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    const website = await updateWebsite(user.id, params.id, { theme: { ...site.theme, logoUrl: publicUrl } })
    return NextResponse.json({ ok: true, website, url: publicUrl })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Yüklenemedi'
    console.error('[website:logo]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Logoyu kaldır. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const site = await getWebsite(user.id, params.id)
    if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
    const website = await updateWebsite(user.id, params.id, { theme: { ...site.theme, logoUrl: null } })
    return NextResponse.json({ ok: true, website })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Kaldırılamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
