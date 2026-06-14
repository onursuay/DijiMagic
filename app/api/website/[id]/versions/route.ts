import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { listVersions, rollbackToVersion } from '@/lib/website/store'

export const dynamic = 'force-dynamic'

/** Sürüm geçmişi. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const versions = await listVersions(user.id, params.id)
    return NextResponse.json({ ok: true, versions })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Bir sürüme geri dön. Body: { versionId }. Kredi düşmez (geri alma ücretsiz). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as { versionId?: string }
    if (!body.versionId) return NextResponse.json({ ok: false, error: 'versionId gerekli' }, { status: 400 })
    const pages = await rollbackToVersion(user.id, params.id, body.versionId)
    if (!pages) return NextResponse.json({ ok: false, error: 'Sürüm bulunamadı' }, { status: 404 })
    return NextResponse.json({ ok: true, pages })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Geri alınamadı'
    console.error('[website:rollback]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
