import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite } from '@/lib/website/store'
import { getCreditEvents } from '@/lib/website/creditEvents'

export const dynamic = 'force-dynamic'

/**
 * Adım-adım kredi telemetri akışı (#builder-5b) — CreditUsageTimeline UI bunu yoklar.
 *
 * Owner-scoped: getCurrentUser + getWebsite(user.id, id) ile sahiplik doğrulanır
 * (yabancı/var olmayan site → 404). website_credit_events tek gerçek charge'ın faz
 * kırılımıdır (TELEMETRİ); gerçek bakiye credit_transactions'ta atomik kalır.
 *
 * MVP: basit JSON poll (SSE değil). Migration uygulanmamışsa store fail-soft → [].
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const site = await getWebsite(user.id, params.id)
    if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
    const events = await getCreditEvents(user.id, params.id)
    return NextResponse.json({ ok: true, events })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Alınamadı'
    console.error('[website:credit-events]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
