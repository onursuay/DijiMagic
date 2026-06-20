import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getBillingProfile, saveBillingProfile, type BillingProfile } from '@/lib/billing/billingProfile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/billing/profile — mevcut kullanıcının fatura profilini döner (yoksa null).
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const profile = await getBillingProfile(user.id)
  return NextResponse.json({ ok: true, profile })
}

// POST /api/billing/profile — fatura profilini kaydeder (sunucu tarafı, sahiplik garantili).
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as BillingProfile | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  const ok = await saveBillingProfile(user.id, body)
  if (!ok) return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
