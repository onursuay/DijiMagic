import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { listWebsites, createWebsite } from '@/lib/website/store'
import type { WebsiteDraftInput } from '@/lib/website/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const websites = await listWebsites(user.id)
    return NextResponse.json({ ok: true, websites })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Liste alınamadı'
    console.error('[website:list]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<WebsiteDraftInput>
    const website = await createWebsite(user.id, {
      label: body.label ?? 'Yeni Web Sitesi',
      siteType: body.siteType,
      category: body.category ?? null,
      defaultLocale: body.defaultLocale,
      locales: body.locales,
      theme: body.theme,
    })
    return NextResponse.json({ ok: true, website }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Oluşturulamadı'
    console.error('[website:create]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
