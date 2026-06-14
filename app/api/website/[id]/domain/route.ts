import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite, updateWebsite } from '@/lib/website/store'
import { attachDomain, removeDomain, checkDomainConfig, isVercelDomainReady } from '@/lib/website/vercelDomain'
import { setCustomDomainMapping, removeCustomDomainMapping } from '@/lib/website/edgeConfig'

export const dynamic = 'force-dynamic'

const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_8xpk4I5Dqje7iCugJj7MMaAtQtxo'
const DOMAIN_RE = /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i

/** Mevcut domain + DNS doğrulama durumu. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  const site = await getWebsite(user.id, params.id)
  if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
  const domain = site.theme?.customDomain ?? null
  if (!domain) return NextResponse.json({ ok: true, domain: null, configured: isVercelDomainReady() })
  const cfg = await checkDomainConfig(domain)
  return NextResponse.json({ ok: true, domain, configured: isVercelDomainReady(), ...cfg })
}

/** Domaini bağla. Body: { domain }. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  if (!isVercelDomainReady()) return NextResponse.json({ ok: false, error: 'Domain servisi yapılandırılmamış' }, { status: 503 })
  try {
    const site = await getWebsite(user.id, params.id)
    if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
    const body = (await req.json().catch(() => ({}))) as { domain?: string }
    const domain = (body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!DOMAIN_RE.test(domain)) return NextResponse.json({ ok: false, error: 'Geçersiz alan adı' }, { status: 400 })

    const result = await attachDomain(PROJECT_ID, domain)
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error || 'Bağlanamadı' }, { status: 502 })

    await setCustomDomainMapping(domain, site.subdomain)
    const website = await updateWebsite(user.id, params.id, { theme: { ...site.theme, customDomain: domain } })
    return NextResponse.json({ ok: true, website, domain, verified: result.verified, records: result.records })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Bağlanamadı'
    console.error('[website:domain]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Domain bağlantısını kaldır. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const site = await getWebsite(user.id, params.id)
    if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
    const domain = site.theme?.customDomain
    if (domain) {
      await removeDomain(PROJECT_ID, domain).catch(() => {})
      await removeCustomDomainMapping(domain).catch(() => {})
    }
    const website = await updateWebsite(user.id, params.id, { theme: { ...site.theme, customDomain: null } })
    return NextResponse.json({ ok: true, website })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Kaldırılamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
