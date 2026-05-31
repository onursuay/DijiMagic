import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { sendCampaign } from '@/lib/email/sender'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** POST /api/email/campaigns/[id]/send — kampanyayı şimdi gönder. */
export async function POST(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const { id } = await params
  const result = await sendCampaign(access.user.id, id)
  return NextResponse.json(result)
}
