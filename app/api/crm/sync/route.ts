import { NextResponse } from 'next/server'
import { checkCrmAccess } from '@/lib/crm/guard'
import { pullLeadsForUser } from '@/lib/crm/metaLeadPull'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/crm/sync — "Lead'leri Çek" (manuel pull).
 * Bağlı sayfaların formlarından lead'leri çekip CRM'e idempotent yazar
 * (leads_retrieval; pages_manage_metadata/webhook gerektirmez).
 */
export async function POST() {
  const access = await checkCrmAccess()
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  const result = await pullLeadsForUser(access.user.id, { startedAt: Date.now(), budgetMs: 50_000 })
  return NextResponse.json({
    ok: result.ok,
    inserted: result.inserted,
    processed: result.processed,
    pages: result.pages,
    reason: result.reason,
  })
}
