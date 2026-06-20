import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { ingestLeadgen } from '@/lib/crm/metaLeadIngest'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN
const DEBUG = process.env.NODE_ENV !== 'production'

/**
 * Meta webhook imza doğrulaması — X-Hub-Signature-256 (HMAC-SHA256, app secret).
 * Header formatı: "sha256=<hexdigest>"; imza HAM gövde üzerinden hesaplanır.
 * Sabit-zaman karşılaştırma ile (timingSafeEqual) sahte leadgen enjeksiyonu engellenir.
 */
function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * GET — Meta Webhook Verification (hub.challenge handshake)
 * Meta sends: ?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
 */
export async function GET(request: Request) {
  if (!VERIFY_TOKEN) {
    console.error('[Webhook] META_WEBHOOK_VERIFY_TOKEN not configured — verification disabled')
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verification successful')
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  console.warn('[Webhook] Verification failed — token mismatch')
  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

/**
 * POST — Incoming webhook events from Meta (leadgen, etc.)
 * Meta expects 200 within 20 seconds, otherwise retries.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text()

    // GÜVENLİK: İmzasız/sahte leadgen enjeksiyonunu engelle. Meta her POST'u
    // app secret ile imzalar (X-Hub-Signature-256). Doğrulanmayan istek İŞLENMEZ
    // (Meta retry'ı tetiklememek için 200 döner ama hiçbir şey yapılmaz).
    const appSecret = process.env.META_APP_SECRET
    if (!appSecret) {
      console.error('[Webhook] META_APP_SECRET tanımlı değil — imzasız webhook reddedildi')
      return NextResponse.json({ received: true })
    }
    if (!verifyWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
      console.warn('[Webhook] Geçersiz X-Hub-Signature-256 — istek reddedildi')
      return NextResponse.json({ received: true })
    }

    const body = JSON.parse(rawBody)

    if (DEBUG) {
      console.log('[Webhook] Incoming event:', JSON.stringify(body, null, 2))
    }

    if (body.object !== 'page') {
      return NextResponse.json({ received: true })
    }

    const entries = body.entry || []

    for (const entry of entries) {
      const pageId = entry.id
      const changes = entry.changes || []

      for (const change of changes) {
        if (change.field === 'leadgen') {
          const leadData = change.value
          const leadgenId = leadData?.leadgen_id
          const formId = leadData?.form_id
          console.log(`[Webhook] 🎯 New Lead! Page: ${pageId}, Form: ${formId}, Lead: ${leadgenId}`)

          // CRM ingestion: lead detayını çek + crm_leads'e idempotent yaz.
          // Fire-and-forget — Meta 20sn içinde 200 bekler; ingest'i await etmeyiz,
          // hata non-fatal (loglanır, webhook yine 200 döner).
          if (leadgenId && pageId) {
            ingestLeadgen(String(pageId), String(leadgenId), formId ? String(formId) : undefined).catch(
              (err) => console.error('[Webhook] CRM ingest error', err),
            )
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Webhook] Error processing:', error)
    return NextResponse.json({ received: true })
  }
}
