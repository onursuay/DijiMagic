import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite, getPages } from '@/lib/website/store'
import SiteRenderer from '@/lib/website/render/SiteRenderer'
import { assembleDocument } from '@/lib/website/codegen/assembleDocument'
import { themeToDesignVars } from '@/lib/website/render/designVars'

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

  // Codegen taslakları (format='html') sandboxlu bir iframe içinde render edilir:
  // assembleDocument SERVER-ONLY (fs ile runtime'ı inline gömer) + async olduğundan bu
  // server component içinde await edilip srcDoc'a string olarak verilir. Runtime inline olduğu
  // için srcdoc same-origin fetch gerektirmez → sandbox YALNIZ 'allow-scripts' (izolasyon korunur,
  // 'allow-same-origin' KASITLI olarak verilmez). 'sections' taslakları eskisi gibi SiteRenderer ile.
  if (page.format === 'html') {
    const doc = await assembleDocument({
      bodyHtml: page.html ?? '',
      designVars: themeToDesignVars(site.theme),
      seo: page.seo ?? {},
      lang: locale || site.defaultLocale,
      fontHref: site.theme?.fontHref ?? null,
      mode: 'preview',
      // MULTIPAGE nav (preview): rewrite data-yoai-href="<slug>" →
      // /website-preview/<id>?slug=<slug>&locale=<locale>. The iframe page reads
      // ?slug and re-renders, so multipage nav works WITHIN the preview without
      // 404ing the dashboard. Landing pages have no data-yoai-href → no-op.
      linkBase: `/website-preview/${params.id}`,
      navMode: 'query',
      localeQuery: locale ? `&locale=${encodeURIComponent(locale)}` : '',
    })
    return (
      <iframe
        srcDoc={doc}
        sandbox="allow-scripts allow-forms"
        className="w-full h-screen border-0"
        title={page.seo?.title || site.label}
      />
    )
  }

  return <SiteRenderer page={page} theme={site.theme} previewId={params.id} />
}
