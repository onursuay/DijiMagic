import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { getWebsite, replacePages, createVersion, getPages, updateWebsite, listVersions } from '@/lib/website/store'
import { generateSitePages, isWebsiteAiReady } from '@/lib/website/ai/generate'
import { resolveSiteColors } from '@/lib/website/render/theme'
import { computeGenerationCost, WEBSITE_REVISION_COST, WEBSITE_FREE_REVISIONS } from '@/lib/website/credits'
import { summarizeSiteForRevision } from '@/lib/website/revisionContext'
import { getProfileByUserId, getIntelligenceByUserId } from '@/lib/yoai/businessProfileStore'
import { generateHtmlSite } from '@/lib/website/codegen/generateHtmlSite'
import type { Website, WebsiteSnapshot, ThemeTokens } from '@/lib/website/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Codegen v2 (serbest HTML) motoru bayrağı. Açık değilse mevcut sections motoru aynen çalışır. */
function isCodegenV2Enabled(): boolean {
  return process.env.WEBSITE_CODEGEN_V2 === '1'
}

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

  // İlk üretim mi revizyon mu. Mevcut sayfa VARSA (sitenin tekrar üretimi/revizesi) revizyondur
  // — talimat boş olsa da (kredi atlatma kapalı). İlk üretim yalnız sayfa hiç yokken.
  const existing = await getPages(user.id, site.id)
  const isRevision = existing.length > 0

  // ── Codegen v2 (serbest HTML) bayrağı açıksa: yeni motor. Kapalıysa aşağıdaki mevcut
  // sections motoru AYNEN çalışır (additive — eski yol byte-byte korunur). ──────────────
  // NOT: maliyet/sayfa sayısı pre-compute'u v2 yolunda KULLANILMAZ — generateWithCodegenV2
  // kendi cost'unu hesaplar. Bu yüzden hesabı v2 erken-return'ünden SONRA, yalnız legacy
  // yol için yapıyoruz (gereksiz compute kaldırıldı; ücret/iade davranışı değişmedi).
  if (isCodegenV2Enabled()) {
    // Revize talimatı + modu motora aktarılır (legacy parite). Boş instructions →
    // ilk üretim davranışı değişmez (initialInstructions kullanılır).
    return generateWithCodegenV2({ user, site, isRevision, instructions, revisionMode })
  }

  // Legacy (sections) yol — maliyet burada hesaplanır. Revizyonda ilk WEBSITE_FREE_REVISIONS
  // adet ÜCRETSİZ, sonrası WEBSITE_REVISION_COST.
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

/**
 * Codegen v2 yolu (WEBSITE_CODEGEN_V2='1'). Faz 1: tek sayfa (anasayfa), tek dil (defaultLocale).
 *
 * Akış: kredi düş (üretimden ÖNCE; owner bypass + yetersiz bakiye 402) → generateHtmlSite →
 *   • başarı  → replacePages([page]) (html + format='html' DB'ye yazılır) +
 *               theme.designVars/compiledCssVersion yansıt + createVersion(initial|revision) →
 *               mevcut yanıt şekliyle döner.
 *   • gate fail (self-repair sonrası bile bozuk) → access.refund() + 422. Bozuk/boş site ASLA
 *     persist edilmez/yayınlanmaz; sessizce deterministik motora DÜŞMEZ (brief kararı).
 */
async function generateWithCodegenV2({
  user,
  site,
  isRevision,
  instructions,
  revisionMode,
}: {
  user: { id: string }
  site: Website
  isRevision: boolean
  /** Revize talimatı (POST gövdesinden parse edilmiş). Boş → ilk üretim (initialInstructions). */
  instructions: string
  /** 'edit' | 'reject' | undefined — legacy revize modu semantiği. */
  revisionMode: 'edit' | 'reject' | undefined
}): Promise<NextResponse> {
  // Maliyet — legacy yolla PARİTE:
  //   • İlk üretim → computeGenerationCost (landing: tek sayfa; multipage: ort. 4 sayfa,
  //     orchestrator 3..6 üretir; çoklu dil ek diller dahil dil sayısıyla ücretlendirilir).
  //   • Revizyon → ilk WEBSITE_FREE_REVISIONS adet ÜCRETSİZ, sonrası WEBSITE_REVISION_COST.
  //     (Eskiden v2 her revizyonda tam üretim maliyetini düşürüyordu — "ilk 3 revize
  //     ücretsiz" politikasını yok sayıyordu. Legacy ile aynı listVersions sayımına geçildi.)
  let cost: number
  if (isRevision) {
    const versions = await listVersions(user.id, site.id)
    const usedRevisions = versions.filter((v) => v.reason === 'revision').length
    cost = usedRevisions < WEBSITE_FREE_REVISIONS ? 0 : WEBSITE_REVISION_COST
  } else {
    const pageCount = site.siteType === 'multipage' ? 4 : 1
    const localeCount = site.locales.length || 1
    cost = computeGenerationCost({ siteType: site.siteType, pageCount, localeCount })
  }

  // Krediyi ÜRETİMDEN ÖNCE düş (owner bypass + yetersiz bakiye 402 featureGuard içinde).
  const access = await chargeFeature({ featureKey: 'website_generation', creditCost: cost })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  let result: Awaited<ReturnType<typeof generateHtmlSite>>
  try {
    // Revize talimatı (varsa) motora aktarılır → her sayfanın prompt'una ulaşır,
    // ctx.instruction olarak initialInstructions'ın ÖNÜNE geçer. Boşsa davranış değişmez.
    result = await generateHtmlSite(user.id, site, { instructions, revisionMode })
  } catch (e) {
    // generateHtmlSite soft-fail sözleşmelidir; yine de beklenmedik throw olursa krediyi iade et.
    await access.refund()
    const message = e instanceof Error ? e.message : 'Üretilemedi'
    console.error('[website:generate:v2]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  // Gate başarısız (self-repair sonrası bile) → iade + 422. Canlıya bozuk site çıkmaz.
  if (result.ok === false) {
    await access.refund()
    console.warn('[website:generate:v2] gate fail:', result.reason)
    return NextResponse.json(
      { ok: false, error: 'Site oluşturulamadı, lütfen tekrar deneyin.' },
      { status: 422 },
    )
  }

  try {
    // Stage-1 designVars'ı temaya yaz (servis bunu themeToDesignVars ile aynı şekilde okur:
    // theme.designVars = Record<string,string>). compiledCssVersion bump → per-site CSS cache.
    const theme: ThemeTokens = {
      ...site.theme,
      designVars: result.designVars,
      compiledCssVersion: new Date().toISOString(),
    }
    await updateWebsite(user.id, site.id, { theme })

    // Sayfaları yaz — landing → [home]; multipage → tüm sayfalar (result.pages).
    // page.html + page.format='html' (carry-in: store bunları kolonlara map eder).
    const pages = await replacePages(user.id, site.id, result.pages)

    const snapshot: WebsiteSnapshot = {
      website: {
        label: site.label,
        siteType: site.siteType,
        defaultLocale: site.defaultLocale,
        locales: site.locales,
        category: site.category,
        theme, // designVars + compiledCssVersion dahil → rollback bunları geri yükler
      },
      pages, // html + format taşır (rowToPage map eder) → rollback bozulmadan geri yükler
    }
    await createVersion(site.id, snapshot, isRevision ? 'revision' : 'initial', access.spent)

    return NextResponse.json({ ok: true, pages, creditCharged: access.spent })
  } catch (e) {
    // Persist aşamasında hata → krediyi iade et (üretildi ama yazılamadı; çift ücret olmasın).
    await access.refund()
    const message = e instanceof Error ? e.message : 'Üretilemedi'
    console.error('[website:generate:v2]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
