/**
 * POST /api/website/[id]/jobs/[jobId]/progress
 *
 * Sandbox callback — üretim ilerleme güncellemesi.
 * HMAC doğrulaması: x-sandbox-signature-256 header (sha256=<hex>)
 * Sır: process.env.WEBSITE_SANDBOX_HMAC_SECRET
 *
 * Body: { stage: string; progress: number; stepMsg: string }
 *
 * Yanıt:
 *   { ok: true }
 *   { ok: false, error: 'not_configured' | 'bad_signature' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySandboxSignature } from '@/lib/website/sandboxHmac.mjs'
import { appendJobLog } from '@/lib/website/genJobStore'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; jobId: string } },
) {
  const secret = process.env.WEBSITE_SANDBOX_HMAC_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 })
  }

  const rawBody = await req.text()
  const signatureHeader = req.headers.get('x-sandbox-signature-256')

  if (!verifySandboxSignature(rawBody, signatureHeader, secret)) {
    return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 401 })
  }

  const { stage, progress, stepMsg } = JSON.parse(rawBody) as {
    stage: string
    progress: number
    stepMsg: string
  }

  await appendJobLog(params.jobId, stage, progress, stepMsg)

  return NextResponse.json({ ok: true })
}
