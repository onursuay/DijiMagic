import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { getCampaign, upsertCampaign, deleteCampaign } from '@/lib/email/campaignStore'
import type { Segment } from '@/lib/email/segments'

export const dynamic = 'force-dynamic'

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const { id } = await params
  const c = await getCampaign(id, access.user.id)
  if (!c) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  return NextResponse.json({
    ok: true,
    campaign: {
      id: c.id, name: c.name, subject: c.subject, html: c.html,
      fromName: c.from_name, fromEmail: c.from_email, segment: c.segment,
      status: c.status, scheduledAt: c.scheduled_at, sentAt: c.sent_at, stats: c.stats,
    },
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }

  const row = await upsertCampaign(access.user.id, {
    id,
    name: body.name != null ? String(body.name) : undefined,
    subject: body.subject != null ? String(body.subject) : undefined,
    html: body.html != null ? String(body.html) : undefined,
    fromName: body.fromName != null ? String(body.fromName) : undefined,
    fromEmail: body.fromEmail != null ? String(body.fromEmail) : undefined,
    segment: body.segment as Segment | undefined,
    scheduledAt: body.scheduledAt !== undefined ? (body.scheduledAt as string | null) : undefined,
    status: body.status as 'draft' | 'scheduled' | undefined,
  })
  if (!row) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const { id } = await params
  const ok = await deleteCampaign(id, access.user.id)
  return NextResponse.json({ ok })
}
