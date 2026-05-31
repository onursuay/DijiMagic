import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { listCampaigns, upsertCampaign } from '@/lib/email/campaignStore'

export const dynamic = 'force-dynamic'

function publicCampaign(c: Awaited<ReturnType<typeof listCampaigns>>[number]) {
  return {
    id: c.id, name: c.name, subject: c.subject, status: c.status,
    segment: c.segment, scheduledAt: c.scheduled_at, sentAt: c.sent_at,
    stats: c.stats, createdAt: c.created_at,
  }
}

/** GET /api/email/campaigns — kampanya listesi. */
export async function GET() {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const rows = await listCampaigns(access.user.id)
  return NextResponse.json({ ok: true, campaigns: rows.map(publicCampaign) })
}

/** POST /api/email/campaigns — yeni kampanya (taslak). */
export async function POST(request: Request) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }

  const row = await upsertCampaign(access.user.id, {
    name: String(body.name ?? 'Yeni kampanya'),
    subject: String(body.subject ?? ''),
    html: String(body.html ?? ''),
    fromName: body.fromName != null ? String(body.fromName) : undefined,
    fromEmail: body.fromEmail != null ? String(body.fromEmail) : undefined,
    segment: (body.segment as { type: 'all' }) ?? { type: 'all' },
    status: 'draft',
  })
  if (!row) return NextResponse.json({ ok: false, error: 'create_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, id: row.id })
}
