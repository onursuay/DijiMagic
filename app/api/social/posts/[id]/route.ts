import { NextRequest, NextResponse } from 'next/server'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { getPost, updatePost, cancelPost, retryPost } from '@/lib/social/store'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })
  const post = await getPost(access.user.id, params.id)
  if (!post) return NextResponse.json({ ok: false, error: 'not_found', message: 'Bulunamadı' }, { status: 404 })
  return NextResponse.json({ ok: true, data: post })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  const body = await req.json().catch(() => ({} as any))

  // Özel aksiyon: başarısız gönderiyi yeniden zamanla
  if (body?.action === 'retry') {
    const ok = await retryPost(access.user.id, params.id)
    if (!ok) return NextResponse.json({ ok: false, error: 'retry_failed', message: 'Yeniden denenemedi' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  const patch: { projectId?: string | null; caption?: string | null; scheduledAt?: string } = {}
  if (body?.projectId !== undefined) patch.projectId = body.projectId
  if (body?.caption !== undefined) patch.caption = body.caption
  if (typeof body?.scheduledAt === 'string') {
    const when = new Date(body.scheduledAt)
    if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Geçerli bir gelecek tarihi gerekli' }, { status: 400 })
    }
    patch.scheduledAt = when.toISOString()
  }
  const ok = await updatePost(access.user.id, params.id, patch)
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'update_failed', message: 'Güncellenemedi (yayınlanmış içerik düzenlenemez)' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })
  const ok = await cancelPost(access.user.id, params.id)
  if (!ok) return NextResponse.json({ ok: false, error: 'cancel_failed', message: 'İptal edilemedi' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
