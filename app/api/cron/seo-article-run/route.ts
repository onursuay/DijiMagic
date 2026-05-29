/* ──────────────────────────────────────────────────────────
   GET /api/cron/seo-article-run

   Saatlik Vercel cron (0 * * * *). enabled olan article_schedules
   içinde, kullanıcının yerel saati publish_time ile eşleşen ve bugün
   henüz çalışmamış olanları bulup `article/generate-publish.user`
   Inngest event'ini fan-out eder.

   Auth: CRON_SECRET (Bearer header). Manuel tetik için admin de bu
   secret ile çağırabilir.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { inngest, isInngestReady } from '@/inngest/client'
import { listEnabledSchedules } from '@/lib/seo/scheduleStore'
import { isScheduleDue } from '@/lib/seo/timezone'
import { runScheduleArticle } from '@/lib/seo/runScheduleArticle'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret && isProduction) {
    return NextResponse.json({ ok: false, error: 'Cron not configured' }, { status: 503 })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const schedules = await listEnabledSchedules()

  const due = schedules.filter((s) =>
    isScheduleDue(s.publish_time, s.timezone, s.frequency, s.weekday, s.last_run_date, now)
  )

  console.log('[seo-cron] enabled:', schedules.length, 'due:', due.length, 'inngest:', isInngestReady())

  if (due.length === 0) {
    return NextResponse.json({ ok: true, due: 0, sent: 0 })
  }

  // Inngest yapılandırılmışsa durable fan-out; aksi halde cron gövdesinde INLINE
  // üret+yayınla — böylece otomatik akış Inngest kurulumuna BAĞIMLI OLMADAN çalışır.
  if (isInngestReady()) {
    const events = due.map((s) => ({
      name: 'article/generate-publish.user' as const,
      data: { scheduleId: s.id, userId: s.user_id },
    }))
    await inngest.send(events)
    return NextResponse.json({ ok: true, mode: 'inngest', due: due.length, sent: events.length })
  }

  // INLINE fallback (Inngest yok). Vercel 60s sınırı için zaman bütçesiyle sırayla;
  // yetişmeyen due'lar bir sonraki saatlik cron'da (catch-up penceresiyle) telafi edilir.
  const startedAt = Date.now()
  const results: Array<Record<string, unknown>> = []
  for (const s of due) {
    try {
      const r = await runScheduleArticle(s.id, s.user_id)
      results.push({ scheduleId: s.id, ...r })
    } catch (e) {
      console.error('[seo-cron] inline_error', s.id, (e as Error).message)
      results.push({ scheduleId: s.id, ok: false, error: (e as Error).message })
    }
    if (Date.now() - startedAt > 45_000) break
  }
  console.log('[seo-cron] inline ran:', results.length, '/', due.length)
  return NextResponse.json({ ok: true, mode: 'inline', due: due.length, ran: results.length, results })
}
