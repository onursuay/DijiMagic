/* ──────────────────────────────────────────────────────────
   Optimizasyon — 4 kapılı skor (Google/TikTok ortak)

   Meta'nın scoring.ts'indeki Teslimat/Verim/Kalite/Doygunluk kapı modelini,
   Google/TikTok'un StandardMetrics verisinden HESAPLAR. Veri olmayan
   sinyallerde (kalite sıralaması, sıklık) "veri yok" notu düşülür ve ceza
   verilmez — SAHTE veri üretilmez.

   Ağırlıklar Meta ile aynı: Teslimat %40, Verim %30, Kalite %15, Doygunluk %15.
   ────────────────────────────────────────────────────────── */

import type { StandardMetrics, RiskLevel } from '@/lib/yoai/analysisTypes'

export type GateStatus = 'pass' | 'warn' | 'fail'

/** Gate-ağırlıklı skordan risk seviyesi (Google/TikTok ortak). */
export function riskFromScore(score: number): RiskLevel {
  if (score >= 70) return 'low'
  if (score >= 45) return 'medium'
  if (score >= 25) return 'high'
  return 'critical'
}

export interface Gate {
  key: 'delivery' | 'efficiency' | 'quality' | 'saturation'
  label: string
  score: number // 0-100
  status: GateStatus
  note?: string
}

export interface GateBreakdown {
  delivery: Gate
  efficiency: Gate
  quality: Gate
  saturation: Gate
}

// Para birimine göre maliyet eşiği çarpanı (googleRuleEngine ile aynı).
function costMultiplier(currency?: string): number {
  switch (currency) {
    case 'TRY': return 6
    case 'BRL': return 3
    case 'INR': return 20
    case 'IDR': return 4000
    case 'JPY': return 30
    case 'GBP': return 0.5
    case 'EUR': return 0.6
    default: return 1 // USD
  }
}

function statusFor(score: number): GateStatus {
  return score >= 70 ? 'pass' : score >= 45 ? 'warn' : 'fail'
}

export function computeGates(metrics: StandardMetrics, currency?: string): { gates: GateBreakdown; score: number } {
  const { spend, impressions, clicks: _clicks, ctr, cpc, conversions, roas } = metrics
  const reach = metrics.reach ?? 0
  const mult = costMultiplier(currency)

  // ── Teslimat (%40) ──
  let delivery: Gate
  if (spend <= 0 && impressions <= 0) {
    delivery = { key: 'delivery', label: 'Teslimat', score: 0, status: 'fail', note: 'Yayın yok' }
  } else if (impressions < 100) {
    delivery = { key: 'delivery', label: 'Teslimat', score: 45, status: 'warn', note: 'Yetersiz veri' }
  } else {
    delivery = { key: 'delivery', label: 'Teslimat', score: 100, status: 'pass' }
  }

  // ── Verim (%30) — CTR + CPC (+ ROAS varsa) ──
  let efficiency: Gate
  if (impressions < 100) {
    efficiency = { key: 'efficiency', label: 'Verim', score: 50, status: 'warn', note: 'Veri az' }
  } else {
    const ctrScore = Math.max(0, Math.min(100, (ctr / 2.0) * 100))
    const cpcThreshold = 5 * mult
    const cpcScore = cpc <= 0 ? 70 : Math.max(0, Math.min(100, (cpcThreshold / cpc) * 100))
    const signals = [ctrScore, cpcScore]
    if (roas != null && conversions >= 1) signals.push(roas >= 2 ? 100 : roas >= 1 ? 60 : 20)
    const avg = Math.round(signals.reduce((a, b) => a + b, 0) / signals.length)
    efficiency = { key: 'efficiency', label: 'Verim', score: avg, status: statusFor(avg) }
  }

  // ── Kalite (%15) — sıralama verisi yok → CTR vekili ──
  let quality: Gate
  if (impressions < 100) {
    quality = { key: 'quality', label: 'Kalite', score: 50, status: 'warn', note: 'Veri az' }
  } else {
    const q = ctr >= 2 ? 100 : ctr >= 1 ? 70 : ctr >= 0.5 ? 45 : 25
    quality = { key: 'quality', label: 'Kalite', score: q, status: statusFor(q), note: 'CTR’ye dayalı (sıralama verisi yok)' }
  }

  // ── Doygunluk (%15) — sıklık = gösterim/erişim ──
  let saturation: Gate
  const freq = reach > 0 ? impressions / reach : 0
  if (freq <= 0) {
    saturation = { key: 'saturation', label: 'Doygunluk', score: 80, status: 'pass', note: 'Sıklık verisi yok' }
  } else {
    const s = freq < 2 ? 100 : freq < 4 ? 70 : freq < 6 ? 40 : 20
    saturation = { key: 'saturation', label: 'Doygunluk', score: s, status: s >= 70 ? 'pass' : s >= 40 ? 'warn' : 'fail', note: `Sıklık ~${freq.toFixed(1)}` }
  }

  const score = Math.round(
    0.40 * delivery.score + 0.30 * efficiency.score + 0.15 * quality.score + 0.15 * saturation.score,
  )

  return { gates: { delivery, efficiency, quality, saturation }, score }
}
