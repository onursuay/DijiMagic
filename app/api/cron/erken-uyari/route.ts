/* ──────────────────────────────────────────────────────────
   GET /api/cron/erken-uyari   (Günlük Nöbetçi — 05:00 UTC)

   Vercel cron tarafından her sabah tetiklenir. Deterministik, LLM'siz:
   bağlı her kullanıcının aktif Meta+Google hesaplarını tarar, acil/bozulma
   tespit eder (account_alerts'e wd_* yazar) + uyarı e-postası gönderir.

   Feature flag: WATCHDOG_ENABLED=true olmadıkça no-op (sıfır maliyet).
   Auth: CRON_SECRET (Bearer header). ?onlyUser=<id> → tek kullanıcı smoke
   (CRON_SECRET ile flag bypass — kontrollü rollout için).

   Maliyet: yapay zekâ ÇAĞRISI YOK. Yalnız Meta/Google salt-okuma API çağrıları.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { isWatchdogEnabled } from '@/lib/yoai/featureFlag'
import { runWatchdogForUser } from '@/lib/yoai/watchdog/runWatchdog'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // hesap başına salt-okuma API çağrıları — sıralı işlenir

const MAX_USERS_PER_RUN = 200

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

  const url = new URL(request.url)
  const onlyUser = url.searchParams.get('onlyUser')
  const adminOverride = Boolean(onlyUser) && Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`

  if (!isWatchdogEnabled() && !adminOverride) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'WATCHDOG_ENABLED=false' })
  }

  const { supabase } = await import('@/lib/supabase/client')
  if (!supabase) return NextResponse.json({ ok: false, error: 'Database yok' }, { status: 500 })

  // Aktif bağlantısı olan kullanıcıları topla (Meta veya Google)
  const userIds = new Set<string>()
  if (onlyUser) {
    userIds.add(onlyUser)
  } else {
    const { data: metaConns } = await supabase.from('meta_connections').select('user_id').eq('status', 'active')
    const { data: googleConns } = await supabase.from('google_ads_connections').select('user_id').eq('status', 'active')
    metaConns?.forEach((c: { user_id?: string }) => { if (c.user_id) userIds.add(c.user_id) })
    googleConns?.forEach((c: { user_id?: string }) => { if (c.user_id) userIds.add(c.user_id) })
  }

  if (userIds.size === 0) return NextResponse.json({ ok: true, message: 'Aktif kullanıcı yok', users: 0 })

  const ids = Array.from(userIds).slice(0, MAX_USERS_PER_RUN)
  let totalFindings = 0, totalAlerts = 0, totalScanned = 0
  const perUser: Array<{ userId: string; findings: number; alerts: number; scanned: number; skipped: number; errors: number }> = []

  // Kullanıcılar sıralı işlenir (rate-limit + maxDuration güvenliği).
  for (const userId of ids) {
    try {
      const r = await runWatchdogForUser(userId)
      totalFindings += r.findings.length
      totalAlerts += r.alertsWritten
      totalScanned += r.accountsScanned
      perUser.push({ userId: userId.slice(0, 8) + '…', findings: r.findings.length, alerts: r.alertsWritten, scanned: r.accountsScanned, skipped: r.accountsSkipped, errors: r.errors.length })
    } catch (e) {
      perUser.push({ userId: userId.slice(0, 8) + '…', findings: 0, alerts: 0, scanned: 0, skipped: 0, errors: 1 })
      console.error('[Cron][erken-uyari] user scan failed:', userId.slice(0, 8), e instanceof Error ? e.message : e)
    }
  }

  return NextResponse.json({
    ok: true,
    users: ids.length,
    accountsScanned: totalScanned,
    findings: totalFindings,
    alertsWritten: totalAlerts,
    perUser,
  })
}

/** POST: oturum açmış kullanıcı için manuel tetikleme (admin/test). */
export async function POST() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const userId = readUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

  const r = await runWatchdogForUser(userId)
  return NextResponse.json({
    ok: true, userId: userId.slice(0, 8) + '…',
    accountsScanned: r.accountsScanned, accountsSkipped: r.accountsSkipped,
    findings: r.findings.length, alertsWritten: r.alertsWritten, errors: r.errors,
  })
}
