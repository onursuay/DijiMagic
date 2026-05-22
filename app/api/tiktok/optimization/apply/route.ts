/* POST /api/tiktok/optimization/apply
   Optimizasyon — TikTok kanadı: tek-tık CANLI uygulama. Bir önerinin
   changeSet'ini (kampanya duraklatma / bütçe değişimi) mevcut TikTok
   mutate API'leri ile gerçek hesaba uygular. Rollback = ters newValue.
   Entegrasyon koduna DOKUNULMAZ (yalnız tiktokApiRequest çağrılır).

   Body: { campaignId, changeType: 'status'|'budget', newValue } */

import { NextResponse } from 'next/server'
import { requireOptimizationAccess } from '@/lib/meta/optimization/serverGuard'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const gate = await requireOptimizationAccess()
    if (!gate.ok) return gate.response

    const body = await request.json()
    const { campaignId, changeType, newValue } = body as {
      campaignId: string
      changeType: 'status' | 'budget'
      newValue: string | number
    }

    if (!campaignId || (changeType !== 'status' && changeType !== 'budget')) {
      return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
    }

    const ctx = await getTikTokContext()

    if (changeType === 'status') {
      const optStatus = newValue === 'PAUSED' ? 'DISABLE' : 'ENABLE'
      await tiktokApiRequest<Record<string, unknown>>('/campaign/status/update/', ctx, {
        body: { advertiser_id: ctx.advertiserId, campaign_ids: [campaignId], opt_status: optStatus },
      })
      return NextResponse.json({ ok: true, applied: { campaignId, changeType, newValue: optStatus } })
    }

    const amount = Number(newValue)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'invalid_budget', message: 'Geçersiz bütçe' }, { status: 400 })
    }
    await tiktokApiRequest<Record<string, unknown>>('/campaign/update/', ctx, {
      body: { advertiser_id: ctx.advertiserId, campaign_id: campaignId, budget: amount },
    })
    return NextResponse.json({ ok: true, applied: { campaignId, changeType, newValue: amount } })
  } catch (error) {
    console.error('[TikTok Apply] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'apply_failed', message: error instanceof Error ? error.message : 'Uygulama başarısız' },
      { status: 500 },
    )
  }
}
