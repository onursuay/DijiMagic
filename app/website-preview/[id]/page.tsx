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
  searchParams: { locale?: string; slug?: string; edit?: string }
}) {
  const user = await getCurrentUser()
  if (!user) notFound()
  const site = await getWebsite(user.id, params.id)
  if (!site) notFound()

  const pages = await getPages(user.id, params.id)
  const locale = searchParams?.locale && site.locales.includes(searchParams.locale) ? searchParams.locale : site.defaultLocale
  const slug = searchParams?.slug || 'home'
  // EDIT OVERLAY: ?edit=1 (owner önizleme "Düzenle" toggle) inlines the tiny
  // click-select overlay into the PREVIEW doc only. Absent → normal preview, no overlay.
  const editMode = searchParams?.edit === '1'
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
      // EDIT OVERLAY: inline the click-select script ONLY when ?edit=1 (owner edit
      // toggle). Normal preview (editMode false) stays byte-clean of the overlay.
      editMode,
      // MULTIPAGE nav (preview): rewrite data-dijimagic-href="<slug>" →
      // /website-preview/<id>?slug=<slug>&locale=<locale>. The iframe page reads
      // ?slug and re-renders, so multipage nav works WITHIN the preview without
      // 404ing the dashboard. Landing pages have no data-dijimagic-href → no-op.
      linkBase: `/website-preview/${params.id}`,
      navMode: 'query',
      localeQuery: locale ? `&locale=${encodeURIComponent(locale)}` : '',
      // SLUG-SET-AWARE: a data-dijimagic-href to a page that was not generated resolves
      // to the preview home (?slug=home) instead of pointing at a non-existent page.
      // 'home' is always included; only url-safe slugs are considered known.
      knownSlugs: Array.from(
        new Set<string>([
          'home',
          ...pages
            .map((p) => p.slug)
            .filter((s) => typeof s === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)),
        ]),
      ),
    })
    return (
      <>
        <iframe
          srcDoc={doc}
          sandbox="allow-scripts allow-forms"
          className="w-full h-screen border-0"
          title={page.seo?.title || site.label}
        />
        {/* EDIT RELAY (?edit=1 only): the select overlay lives in the INNER sandboxed
            srcDoc iframe; it posts {type:'dijimagic:select'} to ITS parent — this
            middle (same-origin, owner-only) page. We forward ONLY validated
            dijimagic:select messages up to the onizleme page, which validates
            e.source === this iframe's contentWindow. No other message is relayed.
            Absent when not in edit mode → normal preview is untouched. */}
        {editMode && (
          <script
            dangerouslySetInnerHTML={{
              __html:
                "(function(){try{window.addEventListener('message',function(e){var d=e.data;if(!d||typeof d!=='object'||d.type!=='dijimagic:select')return;if(typeof d.blockId!=='string'||!/^b\\d+$/.test(d.blockId))return;var img=null;if(d.image&&typeof d.image==='object'&&typeof d.image.index==='number'&&d.image.index>=0&&d.image.index<1000&&typeof d.image.src==='string'){img={index:d.image.index,src:d.image.src};}var msg={type:'dijimagic:select',blockId:d.blockId,role:typeof d.role==='string'?d.role:'',text:typeof d.text==='string'?d.text:'',rect:d.rect&&typeof d.rect==='object'?d.rect:null,hasImage:d.hasImage===true};if(img)msg.image=img;if(window.parent&&window.parent!==window){window.parent.postMessage(msg,'*');}});}catch(err){}})();",
            }}
          />
        )}
      </>
    )
  }

  return <SiteRenderer page={page} theme={site.theme} previewId={params.id} />
}
