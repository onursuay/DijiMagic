import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { getWebsite, replacePages, createVersion, getPages, updateWebsite, listVersions } from '@/lib/website/store'
import { generateSitePages, isWebsiteAiReady } from '@/lib/website/ai/generate'
import { resolveSiteColors } from '@/lib/website/render/theme'
import { computeGenerationCost, WEBSITE_REVISION_COST, WEBSITE_FREE_REVISIONS } from '@/lib/website/credits'
import { summarizeSiteForRevision } from '@/lib/website/revisionContext'
import { getProfileByUserId, getIntelligenceByUserId } from '@/lib/dijimagic/businessProfileStore'
import { generateHtmlSite } from '@/lib/website/codegen/generateHtmlSite'
import { applyBlockPatch } from '@/lib/website/codegen/applyBlockPatch'
import { persistGeneratedSite } from '@/lib/website/persistGeneratedSite'
import type { Website, WebsitePageInput, WebsiteSnapshot, ThemeTokens } from '@/lib/website/types'
import { isAgenticEnabled } from '@/lib/website/agenticFlag.mjs'
import { getIsCurrentUserSuperAdmin } from '@/lib/admin/superAdmin'
import { createWebsiteGenJob } from '@/lib/website/genJobStore'
import { inngest } from '@/inngest/client'

export const dynamic = 'force-dynamic'
// Üretim akışı tek istekte şunları yapar: kurulum (auth + profil + kredi DB turları) →
// (≤120sn) Claude içerik çağrısı → stok görsel çözümleme (Pexels, paralel ~10sn) → DB yazımı.
// Bunların TOPLAMI 60sn'yi aşıp Vercel'in fonksiyonu öldürmesine (504 → istemcide ham
// "Site oluşturulamadı.") yol açıyordu — sitenin SÜREKLİ "oluşturulamadı" vermesinin kök nedeni.
// Projedeki diğer ağır/batch-AI route'larıyla (300sn) hizalandı; çoklu-dil + çok-sayfa üretimi
// de bu paya rahat sığar. Stok çağrıları zaten 10sn ile, Claude çağrısı 120sn ile sınırlı →
// fonksiyon asla 300sn'ye dayanmaz, ya tamamlanır ya da düzgün JSON hatası döner (504 değil).
export const maxDuration = 300

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

  const body = (await req.json().catch(() => ({}))) as {
    instructions?: string
    revisionMode?: string
    targetSlug?: string
    targetLocale?: string
  }
  const instructions = typeof body.instructions === 'string' ? body.instructions.trim() : ''
  const revisionMode = body.revisionMode === 'reject' || body.revisionMode === 'edit' ? body.revisionMode : undefined
  // Blok-bazlı chat-edit: önizlemeden gelen hedef sayfa (slug + dil). 'edit' modunda
  // bu varsa cerrahi blok-patch denenir; başarısız olursa tam-üretim fallback'e düşer.
  const targetSlug = typeof body.targetSlug === 'string' ? body.targetSlug.trim() : ''
  const targetLocale = typeof body.targetLocale === 'string' ? body.targetLocale.trim() : ''

  const site = await getWebsite(user.id, params.id)
  if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })

  // İlk üretim mi revizyon mu. Mevcut sayfa VARSA (sitenin tekrar üretimi/revizesi) revizyondur
  // — talimat boş olsa da (kredi atlatma kapalı). İlk üretim yalnız sayfa hiç yokken.
  const existing = await getPages(user.id, site.id)
  const isRevision = existing.length > 0

  // ── Agentic (Faz 1) bayrağı — WEBSITE_AGENTIC='1' açıkken: krediyi düş → job oluştur →
  // orkestratörü tetikle → job bilgisiyle HEMEN dön (<3sn, bloke etmez).
  // Bayrak KAPALIYKEN bu blok ATLANIR; aşağıdaki v2/legacy yollar BYTE-AYNI çalışır. ──
  if (isAgenticEnabled() || (process.env.WEBSITE_AGENTIC_OWNER_ONLY === '1' && await getIsCurrentUserSuperAdmin())) {
    // Maliyet — legacy/v2 yollarıyla PARİTE:
    //   • Revizyon → ilk WEBSITE_FREE_REVISIONS adet ÜCRETSİZ, sonrası WEBSITE_REVISION_COST.
    //   • İlk üretim → computeGenerationCost (multipage: 4 sayfa; lokalizasyon sayısıyla).
    let cost: number
    if (isRevision) {
      const versions = await listVersions(user.id, site.id)
      const usedRevisions = versions.filter((v) => v.reason === 'revision').length
      cost = usedRevisions < WEBSITE_FREE_REVISIONS ? 0 : WEBSITE_REVISION_COST
    } else {
      const pageCount = site.siteType === 'multipage' ? 4 : 1
      cost = computeGenerationCost({ siteType: site.siteType, pageCount, localeCount: site.locales.length || 1 })
    }

    // Krediyi düş (owner bypass + yetersiz bakiye 402 featureGuard içinde).
    const access = await chargeFeature({ featureKey: 'website_generation', creditCost: cost })
    if (!access.ok) return NextResponse.json(access.body, { status: access.status })

    // Job oluştur → DB'ye 'queued' statusuyla kayıt.
    const jobId = await createWebsiteGenJob({
      websiteId: site.id,
      userId: user.id,
      brief: instructions || site.theme?.initialInstructions || '',
      locales: site.locales,
      siteType: site.siteType,
    })

    // Orkestratörü async tetikle — yanıt beklenmez (non-blocking).
    // Payload şekli Task 1.3 ile kilitlidir; websiteAgenticGenerate bunu bekler.
    await inngest.send({
      name: 'website/generate.agentic',
      data: {
        jobId,
        websiteId: site.id,
        userId: user.id,
        brief: instructions || site.theme?.initialInstructions || '',
        locales: site.locales,
        isRevision,
        creditSpent: access.spent,
      },
    })

    // Hemen dön — UI polling ile job durumunu izler.
    return NextResponse.json({
      ok: true,
      jobId,
      polling: `/api/website/${site.id}/job?jobId=${jobId}`,
    })
  }

  // ── Codegen v2 (serbest HTML) bayrağı açıksa: yeni motor. Kapalıysa aşağıdaki mevcut
  // sections motoru AYNEN çalışır (additive — eski yol byte-byte korunur). ──────────────
  // NOT: maliyet/sayfa sayısı pre-compute'u v2 yolunda KULLANILMAZ — generateWithCodegenV2
  // kendi cost'unu hesaplar. Bu yüzden hesabı v2 erken-return'ünden SONRA, yalnız legacy
  // yol için yapıyoruz (gereksiz compute kaldırıldı; ücret/iade davranışı değişmedi).
  if (isCodegenV2Enabled()) {
    // Revize talimatı + modu motora aktarılır (legacy parite). Boş instructions →
    // ilk üretim davranışı değişmez (initialInstructions kullanılır).
    // targetSlug/targetLocale: 'edit' modunda blok-bazlı cerrahi patch tetikler.
    return generateWithCodegenV2({ user, site, isRevision, instructions, revisionMode, targetSlug, targetLocale })
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

    // Çoklu dil — her seçili dil için paralel üret (maxDuration=300 içinde rahat kalır; ilk 4 dil).
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
    // Tüm diller boş döndü (Claude null/parse hatası) → kullanıcıya HAM 'AI_GENERATION_FAILED'
    // kodu göstermek yerine (UI ham teknik terim göstermez) kullanıcı-dostu mesaj fırlat.
    // Kredi aşağıdaki catch'te iade edilir; istemcide "Yeniden Dene" çalışır.
    if (pageInputs.length === 0) throw new Error('Site içeriği üretilemedi, lütfen tekrar deneyin.')

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
  targetSlug,
  targetLocale,
}: {
  user: { id: string }
  site: Website
  isRevision: boolean
  /** Revize talimatı (POST gövdesinden parse edilmiş). Boş → ilk üretim (initialInstructions). */
  instructions: string
  /** 'edit' | 'reject' | undefined — legacy revize modu semantiği. */
  revisionMode: 'edit' | 'reject' | undefined
  /** Önizlemede görüntülenen sayfanın slug'ı (blok-patch hedefi). Boş → tam üretim. */
  targetSlug: string
  /** Önizlemede görüntülenen sayfanın dili (blok-patch hedefi). */
  targetLocale: string
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

  // ── Blok-bazlı chat-edit (cerrahi revize) ────────────────────────────────────
  // 'edit' modunda + hedef sayfa (targetSlug) verilmişse: yalnız o sayfanın hedef
  // bloklarını yeniden üretip birleştir → dokunulmayan bloklar BYTE-AYNI kalır.
  // Başarılı (gate geçti) → yalnız o sayfayı persist et (diğer sayfalar byte-aynı) +
  // createVersion('revision'). Başarısız (ok:false) → MEVCUT tam-üretim fallback'e DÜŞ
  // (kredi iade edilmez; aynı revizyon ücretiyle tam üretim çalışır). reject / hedef
  // yok → aşağıdaki tam-üretim aynen çalışır.
  if (revisionMode === 'edit' && targetSlug) {
    try {
      const patch = await applyBlockPatch(user.id, site, { targetSlug, targetLocale, instruction: instructions })
      if (patch.ok === true) {
        const persisted = await persistBlockPatch(user.id, site, patch.page, access.spent)
        if (persisted) {
          return NextResponse.json({ ok: true, pages: persisted, creditCharged: access.spent })
        }
        // persist edilemedi → tam-üretim fallback'e düş (kredi zaten düşüldü; iade etme).
      } else {
        console.warn('[website:generate:v2] block-patch fallback:', patch.reason)
      }
    } catch (e) {
      // Beklenmedik throw → tam-üretim fallback (edit asla çıkmaza girmez).
      console.warn('[website:generate:v2] block-patch threw, full regen fallback:', e instanceof Error ? e.message : e)
    }
    // Buraya düşüldü → blok-patch uygulanamadı; aşağıdaki tam-üretim fallback çalışır.
  }

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
    const { pages } = await persistGeneratedSite(user.id, site, result, isRevision, access.spent)
    return NextResponse.json({ ok: true, pages, creditCharged: access.spent })
  } catch (e) {
    // Persist aşamasında hata → krediyi iade et (üretildi ama yazılamadı; çift ücret olmasın).
    await access.refund()
    const message = e instanceof Error ? e.message : 'Üretilemedi'
    console.error('[website:generate:v2]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/**
 * Blok-patch çıktısını persist eder: YALNIZ hedef sayfanın html'i değişir; diğer tüm
 * sayfalar (ve diller) MEVCUT html'leriyle BYTE-AYNI yazılır. theme/designVars
 * DOKUNULMAZ (blok-patch tasarım sistemini değiştirmez). Yeni bir 'revision' sürümü
 * kaydedilir (otomatik snapshot → "Geri Al" çalışır). Hata olursa null döner →
 * çağıran tam-üretim fallback'e düşer (kredi iade edilmez; aynı ücretle tam üretim).
 *
 * @returns persist edilen sayfa listesi (UI bunu setPages ile kullanır) veya null
 */
async function persistBlockPatch(
  userId: string,
  site: Website,
  patchedPage: WebsitePageInput,
  creditCharged: number,
): Promise<Awaited<ReturnType<typeof replacePages>> | null> {
  try {
    const current = await getPages(userId, site.id)
    if (current.length === 0) return null

    // Yalnız hedef sayfayı (slug + locale) değiştir; gerisi byte-aynı kalır.
    const inputs: WebsitePageInput[] = current.map((p) => {
      const isTarget = p.slug === patchedPage.slug && p.locale === patchedPage.locale
      return {
        locale: p.locale,
        slug: p.slug,
        pageRole: p.pageRole,
        sections: p.sections,
        seo: isTarget ? (patchedPage.seo ?? p.seo) : p.seo,
        orderIndex: p.orderIndex,
        html: isTarget ? patchedPage.html : p.html,
        format: p.format, // dokunulmayan sayfalar formatını korur; hedef zaten 'html'
      }
    })

    const pages = await replacePages(userId, site.id, inputs)

    const snapshot: WebsiteSnapshot = {
      website: {
        label: site.label,
        siteType: site.siteType,
        defaultLocale: site.defaultLocale,
        locales: site.locales,
        category: site.category,
        theme: site.theme, // designVars/compiledCssVersion KORUNUR (patch temayı değiştirmez)
      },
      pages,
    }
    await createVersion(site.id, snapshot, 'revision', creditCharged)
    return pages
  } catch (e) {
    console.error('[website:generate:v2] block-patch persist failed:', e instanceof Error ? e.message : e)
    return null
  }
}
