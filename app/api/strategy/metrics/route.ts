import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

// GET /api/strategy/metrics?range=7 — Tüm instance'lar için toplam KPI
export async function GET(request: Request) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rangeDays = parseInt(searchParams.get('range') || '7', 10)

  // Tüm instance ID'lerini al
  const { data: instances } = await supabase
    .from('strategy_instances')
    .select('id, monthly_budget_try')
    .eq('ad_account_id', ctx.accountId)

  if (!instances?.length) {
    return NextResponse.json({
      ok: true,
      kpi: { total_budget: 0, remaining_budget: 0, spend: 0, clicks: 0, roas: 0 },
    })
  }

  const instanceIds = instances.map((i) => i.id)
  const totalBudget = instances.reduce((sum, i) => sum + (i.monthly_budget_try || 0), 0)

  // Seçili aralık (performans) + 30 gün (aylık kalan bütçe) snapshot'larını çek.
  // total_budget AYLIK plandır → "Kalan Bütçe" de aylık kalmalı (aralıktan bağımsız).
  const rangesToFetch = Array.from(new Set([rangeDays, 30]))
  const { data: snapshots } = await supabase
    .from('metrics_snapshots')
    .select('strategy_instance_id, range_days, spend_try, clicks, roas, created_at')
    .in('strategy_instance_id', instanceIds)
    .in('range_days', rangesToFetch)
    .order('created_at', { ascending: false })

  // Her (instance, range) için en son snapshot
  type Snap = { spend_try: number; clicks: number; roas: number }
  const latestByKey = new Map<string, Snap>()
  for (const snap of snapshots ?? []) {
    const key = `${snap.strategy_instance_id}:${snap.range_days}`
    if (!latestByKey.has(key)) latestByKey.set(key, snap as Snap)
  }

  let totalSpend = 0   // seçili aralık
  let totalClicks = 0  // seçili aralık
  let totalRoasSum = 0
  let roasCount = 0
  let monthlySpend = 0 // 30 gün → aylık kalan bütçe için

  for (const inst of instances) {
    const sel = latestByKey.get(`${inst.id}:${rangeDays}`)
    if (sel) {
      totalSpend += sel.spend_try || 0
      totalClicks += sel.clicks || 0
      if (sel.roas > 0) { totalRoasSum += sel.roas; roasCount++ }
    }
    const monthly = latestByKey.get(`${inst.id}:30`)
    if (monthly) monthlySpend += monthly.spend_try || 0
  }

  const avgRoas = roasCount > 0 ? Math.round((totalRoasSum / roasCount) * 100) / 100 : 0

  return NextResponse.json({
    ok: true,
    kpi: {
      total_budget: totalBudget,                                  // aylık plan (sabit)
      remaining_budget: Math.max(0, totalBudget - monthlySpend),  // aylık kalan (30g harcamaya göre)
      spend: totalSpend,                                          // seçili aralık
      clicks: totalClicks,                                        // seçili aralık
      roas: avgRoas,                                              // seçili aralık
    },
  })
}
