import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { listActionOutcomes, listActionOutcomesForCampaign } from '@/lib/dijimagic/learningStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/* ────────────────────────────────────────────────────────────
   GET /api/dijimagic/actions/outcomes
   GET /api/dijimagic/actions/outcomes?campaignId=123

   v1: sadece listeleme. Kayıtlı öneriler + uygulama durumları.
   ──────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli.' }, { status: 401 })
    }

    const url = new URL(request.url)
    const campaignId = url.searchParams.get('campaignId')

    const items = campaignId
      ? await listActionOutcomesForCampaign(userId, campaignId)
      : await listActionOutcomes(userId, 200)

    return NextResponse.json({ ok: true, items, count: items.length })
  } catch (error) {
    console.error('[DijiMagic Actions Outcomes] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
