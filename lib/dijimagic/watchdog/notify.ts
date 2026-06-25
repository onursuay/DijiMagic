/* ──────────────────────────────────────────────────────────
   Erken Uyarı — Bildirim (e-posta özeti)

   Bir kullanıcının günlük nöbetçi bulgularını TEK e-posta özeti olarak
   gönderir (Resend). ownerNotifier deseniyle aynı; her gönderim
   notification_log'a yazılır. Bulgu yoksa SESSİZ (gönderim yok).
   ────────────────────────────────────────────────────────── */

import 'server-only'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase/client'
import { OWNER_NOTIFICATION_RECIPIENTS } from '@/lib/notifications/ownerNotifier'
import type { WatchdogFinding, WatchdogSeverity } from './types'

const FROM_EMAIL = process.env.FROM_EMAIL || 'DijiMagic <info@dijimagic.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://dijimagic.com'
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const SEV_RANK: Record<WatchdogSeverity, number> = { critical: 0, high: 1, medium: 2, info: 3 }
const SEV_LABEL: Record<WatchdogSeverity, string> = { critical: 'ACİL', high: 'Yüksek', medium: 'Dikkat', info: 'Bilgi' }
const SEV_COLOR: Record<WatchdogSeverity, string> = { critical: '#dc2626', high: '#dc2626', medium: '#6b7280', info: '#6b7280' }

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function resolveRecipients(userId: string): Promise<string[]> {
  if (!supabase) return OWNER_NOTIFICATION_RECIPIENTS
  try {
    const { data } = await supabase.from('signups').select('email').eq('id', userId).maybeSingle()
    const email = (data as { email?: string } | null)?.email
    if (email) return [email]
  } catch { /* signup okunamazsa owner'a düş */ }
  return OWNER_NOTIFICATION_RECIPIENTS
}

function buildDigestHtml(findings: WatchdogFinding[]): { subject: string; html: string } {
  const sorted = [...findings].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity])
  const criticalCount = findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length
  const subject = criticalCount > 0
    ? `🔴 Reklam uyarısı: ${criticalCount} acil, ${findings.length} toplam — Erken Uyarı`
    : `Reklam uyarısı: ${findings.length} bulgu — Erken Uyarı`

  const cards = sorted.map((f) => `
    <div style="border:1px solid #e5e7eb;border-left:4px solid ${SEV_COLOR[f.severity]};border-radius:8px;padding:14px 16px;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:${SEV_COLOR[f.severity]};text-transform:uppercase;letter-spacing:0.03em;">${SEV_LABEL[f.severity]} · ${escapeHtml(f.accountName)} · ${f.platform === 'meta' ? 'Meta' : 'Google'}</div>
      <div style="font-size:15px;font-weight:600;color:#111827;margin:4px 0 6px;">${escapeHtml(f.title)}</div>
      <div style="font-size:13px;color:#4b5563;line-height:1.6;">${escapeHtml(f.body)}</div>
      <div style="font-size:13px;color:#111827;margin-top:8px;"><strong>Öneri:</strong> ${escapeHtml(f.recommendedAction)}</div>
    </div>`).join('')

  const html = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#111827;">
      <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;">Günlük Reklam Erken Uyarı</h2>
      <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">Reklam hesaplarınızda dikkat edilmesi gereken ${findings.length} durum tespit edildi.</p>
      ${cards}
      <a href="${APP_URL}/dijialgoritma" style="display:inline-block;margin-top:8px;background:#10b981;color:#ffffff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">DijiMagic'de İncele</a>
      <p style="margin-top:24px;font-size:11px;color:#9ca3af;">DijiMagic · Erken Uyarı · Bu otomatik tarama reklamlara dokunmaz, yalnız bilgilendirir.</p>
    </div>`
  return { subject, html }
}

async function logNotification(recipient: string, subject: string, userId: string, status: 'sent' | 'failed', error: string | null): Promise<void> {
  if (!supabase) return
  try {
    await supabase.from('notification_log').insert({
      recipient, subject, notification_type: 'watchdog_alert', related_user_id: userId, status, error_message: error,
    })
  } catch { /* log yazılamazsa akış kırılmaz */ }
}

/** Bulgu varsa kullanıcıya günlük özet e-postası gönderir. Bulgu yoksa hiçbir şey yapmaz. */
export async function sendWatchdogDigest(userId: string, findings: WatchdogFinding[]): Promise<{ sent: number; failed: number }> {
  if (findings.length === 0) return { sent: 0, failed: 0 }
  const { subject, html } = buildDigestHtml(findings)
  const recipients = await resolveRecipients(userId)
  let sent = 0, failed = 0
  for (const recipient of recipients) {
    if (!resend) { await logNotification(recipient, subject, userId, 'failed', 'RESEND_API_KEY missing'); failed++; continue }
    try {
      await resend.emails.send({ from: FROM_EMAIL, to: recipient, subject, html })
      await logNotification(recipient, subject, userId, 'sent', null)
      sent++
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      await logNotification(recipient, subject, userId, 'failed', msg)
      failed++
    }
  }
  return { sent, failed }
}
