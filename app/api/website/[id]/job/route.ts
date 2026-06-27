/**
 * GET /api/website/[id]/job
 *
 * UI polling endpoint'i — aktif (veya en son) job'un durumunu döner.
 * Owner-only: getCurrentUser + site sahipliği kontrolü.
 *
 * Query params:
 *   ?jobId=<uuid>  → belirli bir job'u sorgular
 *   (yoksa)        → getLatestJobForWebsite ile en son job'u döner
 *
 * Yanıt şekli:
 *   { ok: true, status, stage, progress, lastLog, done, failed, errorReason }
 *   { ok: false, error: 'unauthenticated' | 'not_found' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsiteGenJob, getLatestJobForWebsite } from '@/lib/website/genJobStore'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }

  const jobId = req.nextUrl.searchParams.get('jobId')
  const job = jobId
    ? await getWebsiteGenJob(jobId)
    : await getLatestJobForWebsite(params.id)

  // Sahiplik doğrulama: job yok, farklı kullanıcı veya farklı site → 404
  if (!job || job.userId !== user.id || job.websiteId !== params.id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    lastLog: job.stepLog.at(-1) ?? '',
    done: job.status === 'completed',
    failed: job.status === 'failed' || job.status === 'timeout',
    errorReason: job.errorReason,
  })
}
