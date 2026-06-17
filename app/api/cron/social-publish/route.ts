/* ──────────────────────────────────────────────────────────
   GET /api/cron/social-publish

   Dakikalık Vercel cron (* * * * *). Zamanı gelen (scheduled_at <= now)
   planlanmış sosyal medya gönderilerini atomik claim edip Instagram/Facebook'a
   otomatik yayınlar. Başarısızlıkta sınırlı yeniden deneme (next_retry_at).

   Auth: CRON_SECRET (Bearer header).
   ────────────────────────────────────────────────────────── */
import { NextResponse } from 'next/server'
import { runScheduledPosts } from '@/lib/social/runScheduledPosts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  try {
    const result = await runScheduledPosts(25)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/social-publish] error', err)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
