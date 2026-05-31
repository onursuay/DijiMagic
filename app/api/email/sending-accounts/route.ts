import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { listAccounts, createSmtpAccount, type SendingAccountRow } from '@/lib/email/sendingAccountStore'
import { verifySmtp } from '@/lib/email/smtpSender'
import { assertSafeSmtpHost } from '@/lib/email/ssrf'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Hassas alanları (passEnc) gizleyerek döner. */
function publicAccount(a: SendingAccountRow) {
  const cfg = a.config as { host?: string; user?: string }
  return {
    id: a.id, type: a.type, label: a.label, fromName: a.from_name, fromEmail: a.from_email,
    status: a.status, isDefault: a.is_default, host: cfg.host ?? null, user: cfg.user ?? null,
    createdAt: a.created_at,
  }
}

export async function GET() {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const rows = await listAccounts(access.user.id)
  return NextResponse.json({ ok: true, accounts: rows.map(publicAccount) })
}

/** POST — yeni SMTP gönderim hesabı (önce bağlantı test edilir). */
export async function POST(request: Request) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }

  if (body.type !== 'smtp') return NextResponse.json({ ok: false, error: 'unsupported_type' }, { status: 400 })

  const host = String(body.host ?? '').trim()
  const port = Number(body.port) || 587
  const secure = Boolean(body.secure)
  const user = String(body.user ?? '').trim()
  const pass = String(body.pass ?? '')
  const fromEmail = String(body.fromEmail ?? '').trim().toLowerCase()
  if (!host || !user || !pass || !fromEmail) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
  }

  // SSRF koruması: dahili/özel host'lara bağlanmayı engelle + port allowlist.
  const safe = await assertSafeSmtpHost(host, port)
  if (!safe.ok) {
    console.warn('[SendingAccount] unsafe SMTP host blocked', { host, port, reason: safe.reason })
    return NextResponse.json({ ok: false, error: 'smtp_failed', message: 'Geçersiz SMTP sunucu veya port.' }, { status: 422 })
  }

  // Bağlantı testi — ham hata istemciye SIZDIRILMAZ (yalnız sunucu logu).
  const test = await verifySmtp({ host, port, secure, user, passEnc: '' }, pass)
  if (!test.ok) {
    console.warn('[SendingAccount] SMTP verify failed', { host, port, detail: test.error })
    return NextResponse.json(
      { ok: false, error: 'smtp_failed', message: 'SMTP bağlantısı veya kimlik doğrulaması başarısız. Bilgileri kontrol edin.' },
      { status: 422 },
    )
  }

  const row = await createSmtpAccount(access.user.id, {
    host, port, secure, user, pass, fromEmail,
    fromName: body.fromName != null ? String(body.fromName) : null,
    label: body.label != null ? String(body.label) : null,
  })
  if (!row) return NextResponse.json({ ok: false, error: 'create_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, account: publicAccount(row) })
}
