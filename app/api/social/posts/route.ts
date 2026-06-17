import { NextRequest, NextResponse } from 'next/server'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { listPostsInRange, createPost } from '@/lib/social/store'
import type { SocialFormat, PostTargetInput, PostMediaInput } from '@/lib/social/types'

export const dynamic = 'force-dynamic'

const FORMATS: SocialFormat[] = ['feed', 'reels', 'story']

export async function GET(req: NextRequest) {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'from ve to gerekli' }, { status: 400 })
  }
  const projectId = searchParams.get('projectId')
  const formatParam = searchParams.get('format') as SocialFormat | null
  const format = formatParam && FORMATS.includes(formatParam) ? formatParam : undefined

  const data = await listPostsInRange(access.user.id, { from, to, projectId, format })
  return NextResponse.json({ ok: true, data })
}

export async function POST(req: NextRequest) {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  const body = await req.json().catch(() => ({} as any))
  const format = body?.format as SocialFormat
  const scheduledAt = body?.scheduledAt as string
  const targets = Array.isArray(body?.targets) ? (body.targets as PostTargetInput[]) : []
  const media = Array.isArray(body?.media) ? (body.media as PostMediaInput[]) : []

  // Doğrulama
  if (!FORMATS.includes(format)) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Geçersiz format' }, { status: 400 })
  }
  const when = scheduledAt ? new Date(scheduledAt) : null
  if (!when || isNaN(when.getTime())) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Geçerli bir yayın tarihi gerekli' }, { status: 400 })
  }
  if (when.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Yayın tarihi gelecekte olmalı' }, { status: 400 })
  }
  if (targets.length === 0) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'En az bir hedef hesap seçin' }, { status: 400 })
  }
  if (media.length === 0) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'En az bir medya ekleyin' }, { status: 400 })
  }
  // Format ↔ medya / platform tutarlılığı
  const primaryMedia = media[0]
  if (format === 'reels' && primaryMedia.mediaType !== 'video') {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Reels için video gerekli' }, { status: 400 })
  }
  if (format === 'story' && targets.some((t) => t.platform === 'facebook')) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Facebook Hikaye desteklenmiyor' }, { status: 400 })
  }
  if (targets.some((t) => t.platform === 'instagram' && !t.igUserId)) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Instagram hesabı bağlı değil' }, { status: 400 })
  }

  const post = await createPost(access.user.id, {
    projectId: body?.projectId ?? null,
    format,
    caption: format === 'story' ? null : (body?.caption ?? null),
    scheduledAt: when.toISOString(),
    timezone: typeof body?.timezone === 'string' ? body.timezone : undefined,
    source: body?.source === 'tasarim' ? 'tasarim' : 'upload',
    targets,
    media,
  })
  if (!post) {
    return NextResponse.json({ ok: false, error: 'create_failed', message: 'İçerik planlanamadı' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, data: post })
}
