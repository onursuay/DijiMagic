import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { getWebsite, replacePages, createVersion, getPages, updateWebsite, listVersions } from '@/lib/website/store'
import { generateSitePages, isWebsiteAiReady } from '@/lib/website/ai/generate'
import { resolveSiteColors } from '@/lib/website/render/theme'
import { computeGenerationCost, WEBSITE_REVISION_COST, WEBSITE_FREE_REVISIONS } from '@/lib/website/credits'
import { summarizeSiteForRevision } from '@/lib/website/revisionContext'
import { getProfileByUserId, getIntelligenceByUserId } from '@/lib/yoai/businessProfileStore'
import type { WebsiteSnapshot } from '@/lib/website/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Faz 1c — AI üretim/revizyon. Kredi düşülür (computeGenerationCost / revizyon sabiti),
 * Claude içerik üretir, görseller stoktan bağlanır, sayfalar + sürüm yazılır.
 * Hata/iptal → kredi iade. Claude hazır değilse 503 (kredi düşülmez).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWebsiteAiReady()) {
    return NextResponse.json({ ok: false, error: 'AI servisi yapılandırılmamış.' }, { status: 503 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { instructions?: string; revisionMode?: string }
  const instructions = typeof body.instructions === 'string' ? body.instructions.trim() : ''
  const revisionMode = body.revisionMode === 'reject' || body.revisionMode === 'edit' ? body.revisionMode : undefined

  const site = await getWebsite(user.id, params.id)
  if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })

  // İlk üretim mi revizyon mu → maliyet. Mevcut sayfa VARSA (sitenin tekrar üretimi/revizesi) revizyondur
  // — talimat boş olsa da (kredi atlatma kapalı). İlk üretim yalnız sayfa hiç yokken. Revizyonda ilk
  // WEBSITE_FREE_REVISIONS adet ÜCRETSİZ, sonrası WEBSITE_REVISION_COST.
  const existing = await getPages(user.id, site.id)
  const isRevision = existing.length > 0
  const pageCount = site.siteType === 'landing' ? 1 : 4
  let cost: number
  if (isRevision) {
    const versions = await listVersions(user.id, site.id)
    const usedRevisions = versions.filter((v) => v.reason === 'revision').length
    cost = usedRevisions < WEBSITE_FREE_REVISIONS ? 0 : WEBSITE_REVISION_COST
  } else {
    cost = computeGenerationCost({ siteType: site.siteType, pageCount, localeCount: site.locales.length })
  }

  // Krediyi düş (owner bypass + yetersiz bakiye 402 featureGuard içinde)
  const access = await chargeFeature({ featureKey: 'website_generation', creditCost: cost })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  try {
    const [profile, intelligence] = await Promise.all([
      getProfileByUserId(user.id),
      getIntelligenceByUserId(user.id),
    ])

    // Sektöre göre canlı tema rengini çöz ve siteye yaz (render bunu CSS değişkenine çevirir).
    const sector = [profile?.sector_main, profile?.sector_sub, site.category].filter(Boolean).join(' ')
    const theme = { ...site.theme, ...resolveSiteColors({ brandColor: null, sector }) }
    await updateWebsite(user.id, site.id, { theme })

    // Çoklu dil — her seçili dil için paralel üret (60sn maxDuration içinde kalır; ilk 4 dil).
    const locales = (site.locales.length ? site.locales : [site.defaultLocale]).slice(0, 4)
    const perLocale = await Promise.all(
      locales.map((locale) =>
        generateSitePages({
          subdomain: site.subdomain,
          siteType: site.siteType,
          label: site.label,
          profile,
          intelligence,
          locale,
          instructions,
          referenceUrls: site.theme?.referenceUrls ?? undefined,
          style: site.theme?.style ?? undefined,
          revisionMode,
          // 'edit' (cerrahi) modunda AI'a mevcut o-dil içeriğini ver → belirtilmeyen kısımları korur.
          currentSummary:
            revisionMode === 'edit'
              ? summarizeSiteForRevision(existing.filter((pg) => pg.locale === locale))
              : undefined,
        }),
      ),
    )
    const pageInputs = perLocale.filter((x): x is NonNullable<typeof x> => Boolean(x)).flat()
    if (pageInputs.length === 0) throw new Error('AI_GENERATION_FAILED')

    const pages = await replacePages(user.id, site.id, pageInputs)
    const snapshot: WebsiteSnapshot = {
      website: {
        label: site.label,
        siteType: site.siteType,
        defaultLocale: site.defaultLocale,
        locales: site.locales,
        category: site.category,
        theme,
      },
      pages,
    }
    await createVersion(site.id, snapshot, isRevision ? 'revision' : 'initial', cost)

    return NextResponse.json({ ok: true, pages, creditCharged: access.spent })
  } catch (e) {
    await access.refund()
    const message = e instanceof Error ? e.message : 'Üretilemedi'
    console.error('[website:generate]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
