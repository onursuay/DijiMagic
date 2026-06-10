import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { listContactPageIds } from '@/lib/email/contactStore'
import { listSubscriptions } from '@/lib/crm/pageSubscriptionStore'

export const dynamic = 'force-dynamic'

/**
 * GET /api/email/accounts
 * Kişilerin hesap (Meta sayfa) bazlı filtresi için: kullanıcının CRM'e bağladığı
 * sayfalar + her sayfadaki kişi sayısı. CSV/manuel kişiler hiçbir hesaba bağlı
 * değildir (page_id = null) → yalnız "Tüm Hesaplar"da görünür.
 */
export async function GET() {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  const [subs, counts] = await Promise.all([
    listSubscriptions(access.user.id),
    listContactPageIds(access.user.id),
  ])

  // Bağlı sayfalar (isimli) + kişisi olan ama abonelik kaydı kalmamış sayfalar.
  const seen = new Set<string>()
  const accounts: { pageId: string; pageName: string | null; count: number }[] = []
  for (const s of subs) {
    seen.add(s.page_id)
    accounts.push({ pageId: s.page_id, pageName: s.page_name, count: counts[s.page_id] ?? 0 })
  }
  for (const [pageId, count] of Object.entries(counts)) {
    if (seen.has(pageId)) continue
    accounts.push({ pageId, pageName: null, count })
  }

  return NextResponse.json({ ok: true, accounts })
}
