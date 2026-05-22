/* ──────────────────────────────────────────────────────────
   GET /api/cron/strategy-metrics

   (#2) Strateji modülü "Plan aktifken haftalık metrik analizi + AI
   optimizasyon önerileri otomatik gelir" vaadini gerçekleştirir.

   Vercel cron tarafından haftalık tetiklenir. RUNNING durumdaki her
   strateji instance'ı için bayat (≥7 gün) metrik varsa pull_metrics
   job'u kuyruğa alır (checkPeriodicJobs) ve kuyruğu işler (runQueuedJobs).
   pull_metrics başarıyla biterse optimize job'u zincirlenir.

   Sahte veri YOK: gerçek Meta aktivitesi yoksa snapshot yazılmaz.
   Auth: CRON_SECRET (Bearer header). Prod'da CRON_SECRET zorunlu.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { checkPeriodicJobs, runQueuedJobs } from '@/lib/strategy/job-runner'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret && isProduction) {
    console.error('[Cron][strategy-metrics] CRON_SECRET tanımlı değil — prod\'da reddedildi')
    return NextResponse.json({ ok: false, error: 'Cron not configured' }, { status: 503 })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { supabase } = await import('@/lib/supabase/client')
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Database yok' }, { status: 500 })
  }

  // Tek instance override (smoke / kontrollü test): ?onlyInstance=<id>
  const url = new URL(request.url)
  const onlyInstance = url.searchParams.get('onlyInstance')

  let instanceIds: string[] = []
  if (onlyInstance) {
    instanceIds = [onlyInstance]
  } else {
    const { data: running } = await supabase
      .from('strategy_instances')
      .select('id')
      .eq('status', 'RUNNING')
    instanceIds = (running ?? []).map((r: { id: string }) => r.id)
  }

  if (instanceIds.length === 0) {
    return NextResponse.json({ ok: true, message: 'RUNNING strateji yok', instances: 0 })
  }

  // Bayat metriği olan instance'lar için pull_metrics kuyruğa al
  let enqueued = 0
  for (const id of instanceIds) {
    try {
      const queued = await checkPeriodicJobs(id)
      if (queued) enqueued++
    } catch (e) {
      console.error('[Cron][strategy-metrics] checkPeriodicJobs hata:', id, e)
    }
  }

  // Kuyruğu işle (pull_metrics → optimize zinciri senkron çalışır)
  const result = enqueued > 0 ? await runQueuedJobs() : { processed: 0, errors: 0 }

  return NextResponse.json({
    ok: true,
    instances: instanceIds.length,
    enqueued,
    processed: result.processed,
    errors: result.errors,
    message: `${instanceIds.length} RUNNING instance kontrol edildi, ${enqueued} metrik yenileme tetiklendi`,
  })
}
