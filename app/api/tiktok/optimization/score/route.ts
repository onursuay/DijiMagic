/* GET /api/tiktok/optimization/score
   Optimizasyon — TikTok kanadı. Bağlı TikTok Ads hesabının kampanyalarını
   gerçek rapor metrikleriyle çeker, skorlar (Google rule engine yeniden
   kullanılır) ve ortak şekilde döner. Bağlantı yoksa 401. Meta/Google
   tarafı ETKİLENMEZ. */

import { NextResponse } from 'next/server'
import { requireOptimizationAccess } from '@/lib/meta/optimization/serverGuard'
import { fetchTiktokScoredCampaigns } from '@/lib/tiktok/optimization/score'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const gate = await requireOptimizationAccess()
  if (!gate.ok) return gate.response

  try {
    const { connected, campaigns } = await fetchTiktokScoredCampaigns()
    if (!connected) {
      return NextResponse.json(
        { ok: false, error: 'tiktok_not_connected', message: 'TikTok Ads bağlantısı bulunamadı.' },
        { status: 401 },
      )
    }
    return NextResponse.json({ ok: true, data: { campaigns } })
  } catch (error) {
    console.error('[TikTok Optimization Score] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: error instanceof Error ? error.message : 'Sunucu hatası' },
      { status: 500 },
    )
  }
}
