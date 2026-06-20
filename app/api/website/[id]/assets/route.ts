import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite } from '@/lib/website/store'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/website/[id]/assets
 *
 * Owner-gated image upload for the manual "Görseli değiştir" (replace image) action.
 * Mirrors the logo-upload pattern (Supabase Storage → public https URL) — NO new
 * image infra. The returned URL is fed into the deterministic `replace_image` patch,
 * whose own validator only accepts absolute https URLs (these are).
 *
 * Security:
 *   - getCurrentUser + getWebsite(user.id, id) → 404 if the site isn't theirs.
 *   - Accept ONLY raster image MIME (png/jpeg/webp/gif) — SVG is REFUSED (embedded
 *     <script> = stored-XSS), exactly like the logo route.
 *   - Size cap (8MB) + a magic-byte sniff (the bytes must actually BE that image
 *     type — a renamed .exe with image/png MIME is rejected).
 */

const BUCKET = 'website-assets'
const MAX_BYTES = 8 * 1024 * 1024 // 8MB

// SVG intentionally EXCLUDED (embedded <script> → stored-XSS). Raster only.
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

async function ensureBucket() {
  if (!supabase) return
  try {
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES })
  } catch {
    /* zaten var → yok say */
  }
}

/**
 * Magic-byte sniff: confirm the uploaded bytes really are the claimed image type
 * (so a renamed non-image with a spoofed MIME can't land in storage).
 */
function sniffImageType(buf: Buffer): 'png' | 'jpg' | 'webp' | 'gif' | null {
  if (buf.length < 12) return null
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png'
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  // GIF: "GIF8"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif'
  // WEBP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'webp'
  }
  return null
}

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
      return NextResponse.json({ ok: false, error: 'Yalnız PNG, JPG, WEBP veya GIF görsel' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'En fazla 8MB' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    // Magic-byte sniff — the bytes must actually be a raster image (defeats spoofed MIME).
    const sniffed = sniffImageType(buf)
    if (!sniffed) {
      return NextResponse.json({ ok: false, error: 'Geçerli bir görsel dosyası değil' }, { status: 400 })
    }

    await ensureBucket()
    const path = `${user.id}/${params.id}-${Date.now()}.${sniffed}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type,
      upsert: true,
    })
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    return NextResponse.json({ ok: true, url: publicUrl })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Yüklenemedi'
    console.error('[website:assets]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
