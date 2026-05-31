import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { countRecipients, type Segment } from '@/lib/email/segments'

export const dynamic = 'force-dynamic'

/** POST /api/email/recipients-count { segment } — composer önizleme alıcı sayısı. */
export async function POST(request: Request) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  let body: { segment?: Segment }
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }
  const count = await countRecipients(access.user.id, (body.segment ?? { type: 'all' }) as Segment)
  return NextResponse.json({ ok: true, count })
}
