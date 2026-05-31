/* ──────────────────────────────────────────────────────────
   GET /api/cron/crm-lead-pull

   Saatlik Vercel cron — CRM'e sayfa bağlamış her kullanıcı için
   Meta Lead Ads formlarından yeni lead'leri ÇEKİP crm_leads'e yazar
   (leads_retrieval; webhook/pages_manage_metadata gerektirmez).

   Idempotent (upsert leadgen_id UNIQUE) — mevcut lead/işaretler ezilmez.
   Auth: CRON_SECRET (Bearer header).
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { listAllSubscribedUserIds } from '@/lib/crm/pageSubscriptionStore'
import { pullLeadsForUser } from '@/lib/crm/metaLeadPull'

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

  const startedAt = Date.now()
  const userIds = await listAllSubscribedUserIds()

  let usersProcessed = 0
  let totalInserted = 0

  for (const userId of userIds) {
    // Toplam cron süresini koru (Vercel 60s) — kullanıcı başına küçük bütçe.
    if (Date.now() - startedAt > 50_000) break
    try {
      const res = await pullLeadsForUser(userId, { startedAt, budgetMs: 50_000, maxPagesPerForm: 2 })
      usersProcessed++
      totalInserted += res.inserted
    } catch (err) {
      console.error('[CronCrmPull] user failed', userId.slice(0, 8), err)
    }
  }

  console.log(`[CronCrmPull] users=${usersProcessed}/${userIds.length} newLeads=${totalInserted}`)
  return NextResponse.json({ ok: true, users: usersProcessed, totalUsers: userIds.length, inserted: totalInserted })
}
