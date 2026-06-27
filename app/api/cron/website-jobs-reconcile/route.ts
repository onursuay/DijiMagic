// GET /api/cron/website-jobs-reconcile
//
// Her 5 dakikada bir calisan Vercel cron.
// Inngest event kaybi nedeniyle 'queued' veya 'running'
// durumunda takilip kalan website_gen_jobs satirlarini
// 'timeout'a alir — event-kaybi dayaniklilik bekci (Faz 1.7).
//
// Auth: CRON_SECRET (Bearer header). seo-article-run deseni birebir.

import { NextResponse } from 'next/server'
import { reconcileStaleJobs } from '@/lib/website/genJobStore'

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

  const { reconciled } = await reconcileStaleJobs(15)
  console.log('[website-jobs-reconcile] reconciled:', reconciled)
  return NextResponse.json({ ok: true, reconciled })
}
