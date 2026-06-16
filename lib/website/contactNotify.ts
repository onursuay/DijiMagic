import 'server-only'
import { Resend } from 'resend'

/**
 * Üretilen sitenin iletişim formundan gelen mesajı SİTE SAHİBİNİN e-postasına iletir (Resend).
 * SMTP'den kaçınılır (Vercel giden SMTP portunu engeller). replyTo = ziyaretçi → sahip doğrudan yanıtlar.
 */
const FROM_EMAIL = process.env.FROM_EMAIL || 'YO Dijital Medya Anonim Şirketi <info@yodijital.com>'
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const esc = (s: string | null | undefined): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface ContactSubmission {
  name: string
  email: string
  phone?: string
  message: string
}

export async function notifySiteOwnerOfContact(
  ownerEmail: string,
  siteName: string,
  form: ContactSubmission,
): Promise<boolean> {
  if (!resend || !ownerEmail) return false
  // E-posta header injection savunması: konu satırında CRLF olmaz.
  const safeName = siteName.replace(/[\r\n]+/g, ' ').trim().slice(0, 120) || 'Web Sitesi'
  const subject = `${safeName} — yeni iletişim mesajı`
  const rows: [string, string][] = [
    ['Ad Soyad', esc(form.name)],
    ['E-posta', esc(form.email)],
    ['Telefon', esc(form.phone || '—')],
  ]
  const tableRows = rows
    .map(([k, v]) => `<tr><td style="padding:6px 12px;font-size:13px;color:#6b7280;width:140px;">${k}</td><td style="padding:6px 12px;font-size:13px;color:#111827;">${v}</td></tr>`)
    .join('')
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px 24px;color:#111827;">
      <h2 style="font-size:17px;font-weight:700;margin:0 0 6px;">${esc(safeName)} — yeni iletişim mesajı</h2>
      <p style="font-size:14px;color:#4b5563;margin:0 0 18px;">Web sitenizin iletişim formundan yeni bir mesaj geldi.</p>
      <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;width:100%;">${tableRows}</table>
      <div style="margin-top:18px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;color:#111827;line-height:1.6;white-space:pre-wrap;">${esc(form.message)}</div>
      <p style="margin-top:18px;font-size:12px;color:#9ca3af;">Bu mesajı doğrudan yanıtlayarak gönderene ulaşabilirsiniz.</p>
    </div>`
  try {
    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to: ownerEmail,
      subject,
      html,
      replyTo: form.email,
    })
    if (r.error) throw new Error(r.error.message)
    return true
  } catch (e) {
    console.error('[contactNotify] gönderilemedi:', e instanceof Error ? e.message : e)
    return false
  }
}
