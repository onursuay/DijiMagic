// GET /api/cron/website-jobs-reconcile
//
// Her 5 dakikada bir calisan Vercel cron.
// Inngest event kaybi nedeniyle 'queued' veya 'running'
// durumunda takilip kalan website_gen_jobs satirlarini
// 'timeout'a alir — event-kaybi dayaniklilik bekci (Faz 1.7).
//
// Auth: CRON_SECRET (Bearer header). seo-article-run deseni birebir.

import { NextResponse } from 'next/server'
import { reconcileStaleJobs, findOrphanSandboxes, clearSandboxRef } from '@/lib/website/genJobStore'
import { deleteSandbox } from '@/lib/website/codegen/agentic/runAgenticBuild'

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

  // Orphan sandbox cleanup: jobs that ended (timeout | failed) but still hold a
  // sandbox_id that was never deleted (e.g. dispatch fired but callback never arrived).
  // reconcileStaleJobs above may have just moved some jobs to 'timeout', so we run
  // this AFTER reconcile to catch them in the same cron tick.
  let orphansDeleted = 0
  let orphanErrors = 0
  const orphans = await findOrphanSandboxes()
  for (const { jobId, sandboxId } of orphans) {
    try {
      await deleteSandbox(sandboxId)
    } catch {
      // Sandbox may already be gone (idempotent) — log but continue
      orphanErrors++
      console.warn(`[website-jobs-reconcile] deleteSandbox failed for ${sandboxId} (job ${jobId}) — already deleted?`)
    }
    // Always null out the ref so we don't attempt again on next cron tick
    try {
      await clearSandboxRef(jobId)
      orphansDeleted++
    } catch (e) {
      console.error(`[website-jobs-reconcile] clearSandboxRef failed for job ${jobId}:`, e)
    }
  }
  if (orphans.length > 0) {
    console.log(
      `[website-jobs-reconcile] orphan cleanup: ${orphans.length} found, ` +
      `${orphansDeleted} cleared, ${orphanErrors} delete errors`,
    )
  }

  return NextResponse.json({ ok: true, reconciled, orphansFound: orphans.length, orphansDeleted })
}
