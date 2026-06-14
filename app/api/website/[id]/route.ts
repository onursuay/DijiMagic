import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite, updateWebsite, deleteWebsite } from '@/lib/website/store'
import type { WebsitePatchInput } from '@/lib/website/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const website = await getWebsite(user.id, params.id)
    if (!website) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
    return NextResponse.json({ ok: true, website })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const patch = (await req.json().catch(() => ({}))) as WebsitePatchInput
    const website = await updateWebsite(user.id, params.id, patch)
    if (!website) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
    return NextResponse.json({ ok: true, website })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Güncellenemedi'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const removed = await deleteWebsite(user.id, params.id)
    if (!removed) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Silinemedi'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
