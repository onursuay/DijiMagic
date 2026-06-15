/* ──────────────────────────────────────────────────────────
   /api/yoai/watchdog

   GET  → oturum açmış kullanıcının açık Erken Uyarı (wd_*) uyarıları.
   POST → kullanıcı için manuel tarama tetikle (interaktif; e-posta GÖNDERMEZ,
          yalnız uyarıları tazeler — UI "Şimdi tara" butonu).

   Auth: user_id cookie. Salt-okuma tarama → reklamlara dokunmaz.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { readUserId } from '@/lib/auth/userCookie'
import { listAccountAlertsForUser } from '@/lib/yoai/ai/hierarchicalStore'
import { runWatchdogForUser } from '@/lib/yoai/watchdog/runWatchdog'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  const userId = readUserId(await cookies())
  if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

  const all = await listAccountAlertsForUser(userId, ['pending'])
  const alerts = all.filter((a) => (a.alert_type || '').startsWith('wd_'))
  const counts = {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
  }
  return NextResponse.json({ ok: true, counts, alerts })
}

export async function POST() {
  const userId = readUserId(await cookies())
  if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

  // İnteraktif tarama: e-posta gönderme (kullanıcı zaten ekranda); yalnız uyarıları tazele.
  const r = await runWatchdogForUser(userId, { sendEmail: false })
  return NextResponse.json({
    ok: true,
    accountsScanned: r.accountsScanned,
    accountsSkipped: r.accountsSkipped,
    findings: r.findings.length,
    alertsWritten: r.alertsWritten,
  })
}
