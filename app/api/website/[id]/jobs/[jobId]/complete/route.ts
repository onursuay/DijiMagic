/**
 * POST /api/website/[id]/jobs/[jobId]/complete
 *
 * Sandbox callback — üretim tamamlandı.
 * HMAC doğrulaması: x-sandbox-signature-256 header (sha256=<hex>)
 * Sır: process.env.WEBSITE_SANDBOX_HMAC_SECRET
 *
 * İdempotent: job zaten 'completed' ise DB'ye tekrar yazılmaz.
 * Her iki durumda da `website/generate.sandbox-done` Inngest event'i gönderilir
 * (orkestratörü uyandırır — waitForEvent sözleşmesi).
 *
 * Body: { html: string; designVars: Record<string, string> }
 *
 * Yanıt:
 *   { ok: true }
 *   { ok: false, error: 'not_configured' | 'bad_signature' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySandboxSignature } from '@/lib/website/sandboxHmac.mjs'
import { getWebsiteGenJob, markJobComplete } from '@/lib/website/genJobStore'
import { inngest } from '@/inngest/client'

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

  const { html, designVars } = JSON.parse(rawBody) as {
    html: string
    designVars: Record<string, string>
  }

  // İdempotent: zaten completed ise tekrar yazma (Storage-önce sözleşmesi)
  const existing = await getWebsiteGenJob(params.jobId)
  if (existing && existing.status !== 'completed') {
    await markJobComplete(params.jobId, html, designVars ?? {})
  }

  // Orkestratörü uyandır — her durumda (idempotent Inngest event)
  await inngest.send({
    name: 'website/generate.sandbox-done',
    data: { jobId: params.jobId },
  })

  return NextResponse.json({ ok: true })
}
