import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite, getPages } from '@/lib/website/store'
import SiteRenderer from '@/lib/website/render/SiteRenderer'

export const dynamic = 'force-dynamic'

/**
 * Sahip-özel TASLAK önizleme — iframe içinde gerçek viewport'ta render edilir ki sitenin
 * responsive kırılımları (sm/lg) önizleme kutusunun GERÇEK genişliğine göre çalışsın
 * (inline render'da viewport=tarayıcı genişliği olduğu için masaüstü düzeni dar kutuya sıkışıyordu).
 * Modül layout'u dışında (sidebar yok); kök layout consent'i sahipte zaten verili.
 */
export default async function WebsitePreviewPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { locale?: string; slug?: string }
}) {
  const user = await getCurrentUser()
  if (!user) notFound()
  const site = await getWebsite(user.id, params.id)
  if (!site) notFound()

  const pages = await getPages(user.id, params.id)
  const locale = searchParams?.locale && site.locales.includes(searchParams.locale) ? searchParams.locale : site.defaultLocale
  const slug = searchParams?.slug || 'home'
  const localePages = pages.filter((p) => p.locale === locale)
  const page =
    localePages.find((p) => p.slug === slug) ??
    localePages.find((p) => p.slug === 'home') ??
    localePages[0] ??
    pages[0]

  if (!page) {
    return <div style={{ padding: 48, fontFamily: 'system-ui', color: '#9ca3af', fontSize: 14 }}>—</div>
  }
  return <SiteRenderer page={page} theme={site.theme} />
}
