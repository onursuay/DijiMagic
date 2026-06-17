import { NextRequest, NextResponse } from 'next/server'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { listProjects, createProject } from '@/lib/social/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })
  const data = await listProjects(access.user.id)
  return NextResponse.json({ ok: true, data })
}

export async function POST(req: NextRequest) {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  const body = await req.json().catch(() => ({} as any))
  const name = (body?.name ?? '').toString().trim()
  if (!name) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Proje adı gerekli' }, { status: 400 })
  }
  const project = await createProject(access.user.id, {
    name,
    color: typeof body?.color === 'string' ? body.color : undefined,
    businessScope: body?.businessScope ?? null,
  })
  if (!project) {
    return NextResponse.json({ ok: false, error: 'create_failed', message: 'Proje oluşturulamadı' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, data: project })
}
