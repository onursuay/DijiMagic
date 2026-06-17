import { NextRequest, NextResponse } from 'next/server'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { updateProject, archiveProject } from '@/lib/social/store'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  const body = await req.json().catch(() => ({} as any))
  const patch: Record<string, unknown> = {}
  if (typeof body?.name === 'string') patch.name = body.name.trim()
  if (typeof body?.color === 'string') patch.color = body.color
  if (body?.businessScope !== undefined) patch.business_scope = body.businessScope
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Güncellenecek alan yok' }, { status: 400 })
  }
  const ok = await updateProject(access.user.id, params.id, patch as any)
  if (!ok) return NextResponse.json({ ok: false, error: 'update_failed', message: 'Güncellenemedi' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })
  const ok = await archiveProject(access.user.id, params.id)
  if (!ok) return NextResponse.json({ ok: false, error: 'archive_failed', message: 'Arşivlenemedi' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
