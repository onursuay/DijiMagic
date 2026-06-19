import 'server-only'
/**
 * lib/website/codegen/generateHtmlSite.ts
 *
 * Stage-4 ORCHESTRATOR for the Web Site Yöneticisi code-generation pipeline.
 * Runs the whole free-form-HTML pipeline and GATES the result, with exactly
 * ONE self-repair attempt:
 *
 *   1. buildCodegenContext(userId, website)   — Stage 0 (brand context + quarantine)
 *   2. generateDesignSystem(ctx)              — Stage 1 (soft-fails to safe default)
 *   3. generateHomePageHtml(ctx, ds)          — Stage 3 (throws on failure)
 *   4. gateSiteHtml(body)                     — Stage 9 publish gate
 *   5. on gate failure → ONE self-repair:
 *        repairHomePageHtml(ctx, ds, prevBody, reason) → gate again.
 *        Still failing → { ok:false, reason }. (No second repair.)
 *   6. on gate success → build a WebsitePageInput (home page) and return it
 *      together with the DesignSystem's CSS custom properties (designVars), so
 *      the route (Task 15) can persist them onto website.theme / the snapshot.
 *
 * ── Soft-fail contract ─────────────────────────────────────────────────────
 * This orchestrator NEVER throws. Anything that goes wrong (no API key surfaces
 * as generateHomePageHtml throwing, a parse failure, an unexpected error) is
 * caught and reported as { ok:false, reason }. The CALLER (Task 14/15 generate
 * route) decides the deterministic fallback (lib/website/ai/generate.ts +
 * templates/deterministic) and the credit refund — that logic does NOT live
 * here; this orchestrator only reports ok / false.
 */

import type { PageRole, Website, WebsitePageInput } from '@/lib/website/types'
import { pickStockImage, isStockReady } from '@/lib/website/stock'
import { listVersions } from '@/lib/website/store'
import { buildCodegenContext } from './buildCodegenContext'
import { generateDesignSystem } from './designSystem'
import {
  generateHomePageHtml,
  repairHomePageHtml,
  generatePageHtml,
  repairPageHtml,
  resolveImagePlaceholders,
  toDesignVars,
  type NavPage,
  type PageSpec,
} from './htmlGenerate'
import { planSitePages, type PlannedPage } from './multipagePlan'
import { gateSiteHtml } from './renderGate'
import { translatePageHtml, translateStrings } from './translateHtml'
import { generateSiteBlueprint, buildFallbackBlueprint } from './blueprintGenerator'
import { renderComponent } from './library'
import type { CodegenContext, DesignSystem, SiteBlueprint } from './types'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import {
  inferIndustryTemplateKey as _inferIndustryTemplateKey,
  deriveSiteSeed as _deriveSiteSeed,
  renderBlueprintToPages as _renderBlueprintToPages,
} from './librarySiteShared.mjs'

// Typed wrappers around the pure .mjs library glue (single source of truth).
const inferIndustryTemplateKey = _inferIndustryTemplateKey as (signals: {
  category?: string | null
  siteType?: string | null
  instruction?: string | null
}) => string
const deriveSiteSeed = _deriveSiteSeed as (websiteId: string, versionCount: number) => string
type RenderedLibraryPage = {
  locale: string
  slug: string
  pageRole: string
  orderIndex: number
  html: string
}
const renderBlueprintToPages = _renderBlueprintToPages as (
  blueprint: SiteBlueprint,
  ds: DesignSystem,
  seed: string | number,
  render: typeof renderComponent,
  opts?: { mobileMenuAnim?: 'left' | 'right' | 'top'; defaultLocale?: string },
) => RenderedLibraryPage[]

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Optional revise/regeneration controls (backward-compatible).
 *
 * - `instructions` : the user's revise text (POST body). When non-empty it TAKES
 *                    PRIORITY over website.theme.initialInstructions as ctx.instruction,
 *                    so the regeneration reflects the user's feedback. Empty/absent →
 *                    behaviour is identical to the initial (non-revise) generation.
 * - `revisionMode` : 'edit'  → targeted change (mirror "düzelt"); we still treat the
 *                              instruction as priority intent reaching every page prompt.
 *                    'reject' → "regenerate fresh in a different direction" (legacy
 *                              semantics); the instruction reaches the prompt the same way.
 *                    MVP: any non-empty instruction = "regenerate incorporating this feedback".
 */
export interface GenerateHtmlSiteOptions {
  instructions?: string
  revisionMode?: 'edit' | 'reject'
}

export type GenerateHtmlSiteResult =
  | {
      ok: true
      /** Home page (kept for backward-compat with single-page callers). */
      page: WebsitePageInput
      /** ALL pages (landing → 1 page; multipage → N pages). The route persists this. */
      pages: WebsitePageInput[]
      designVars: Record<string, string>
    }
  | { ok: false; reason: string }

/** Valid PageRole set (mirrors lib/website/types.ts) — coerce planned roles into it. */
const PAGE_ROLE_SET: ReadonlySet<PageRole> = new Set<PageRole>([
  'home', 'about', 'services', 'products', 'contact', 'blog', 'faq', 'gallery', 'custom',
])
function coercePageRole(role: string | undefined): PageRole {
  return role && PAGE_ROLE_SET.has(role as PageRole) ? (role as PageRole) : 'custom'
}

// ---------------------------------------------------------------------------
// SEO derivation — short, brand-derived strings (assembleDocument escapes them)
// ---------------------------------------------------------------------------

/** Collapse whitespace and clamp to a sane length (SEO fields stay short). */
function clamp(s: string, max: number): string {
  const t = (s || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  // Cut on a word boundary where possible, then strip a trailing partial word.
  return t.slice(0, max).replace(/\s+\S*$/, '').trim()
}

/**
 * Derive { title, description } from the CodegenContext.
 *
 *   title       — the brand name (kept verbatim, just clamped).
 *   description — a concise descriptor: the designer's instruction if present,
 *                 else the style direction, else a neutral brand summary line.
 *                 Untrusted external text is NOT used here (it can carry
 *                 injection / off-brand noise — the gate copy already reflects
 *                 the brand; SEO stays minimal and safe).
 */
export function deriveSeo(ctx: CodegenContext): { title: string; description: string } {
  const brand = (ctx.brandName || '').trim() || (ctx.locale === 'en' ? 'Your Brand' : 'Markanız')
  const title = clamp(brand, 70)

  const fallbackDesc =
    ctx.locale === 'en'
      ? `${brand} — official website.`
      : `${brand} resmi web sitesi.`

  const rawDesc =
    (ctx.instruction && ctx.instruction.trim()) ||
    (ctx.style && ctx.style.trim()) ||
    fallbackDesc

  return { title, description: clamp(rawDesc, 160) }
}

/**
 * Derive page-specific SEO for a multipage page.
 *   title       — "<Page title> — <Brand>" (home → just the brand).
 *   description — the page's purpose sentence (brand-derived, AI-planned),
 *                 falling back to the site description. Clamped, escaped later.
 */
function derivePageSeo(
  ctx: CodegenContext,
  plan: PlannedPage,
  siteSeo: { title: string; description: string },
): { title: string; description: string } {
  const brand = (ctx.brandName || '').trim() || (ctx.locale === 'en' ? 'Your Brand' : 'Markanız')
  const pageTitle = (plan.title || '').trim()
  const title =
    plan.role === 'home' || !pageTitle ? siteSeo.title : clamp(`${pageTitle} — ${brand}`, 70)
  const description = clamp((plan.purpose || '').trim() || siteSeo.description, 160)
  return { title, description }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full Stage-4 generation pipeline for the site's HOME page.
 *
 * @param userId   owner of the site (used for context scoping)
 * @param website  the Website row used by buildCodegenContext
 * @param opts     optional revise controls (instructions + revisionMode). When
 *                 opts.instructions is non-empty it takes priority over
 *                 theme.initialInstructions as the prompt instruction (revise applies).
 * @returns
 *   { ok:true, page, designVars } on a gated success, or
 *   { ok:false, reason }          on any failure (never throws).
 */
export async function generateHtmlSite(
  userId: string,
  website: Website,
  opts?: GenerateHtmlSiteOptions,
): Promise<GenerateHtmlSiteResult> {
  try {
    // 1. Context (brand text + quarantined untrusted blocks). The revise instruction
    //    (opts.instructions), when present, becomes ctx.instruction → reaches the design
    //    system prompt + every page's generation prompt (landing + multipage alike) AND
    //    the blueprint generator (library mode), so revise steers either path.
    const ctx = await buildCodegenContext(userId, website, opts)

    // 2. Design system — generated ONCE, shared across every page (consistent look).
    //    Already soft-fails to a safe default; never throws.
    const ds = await generateDesignSystem(ctx)

    // ── Generation MODE (#builder-5a) ──────────────────────────────────────
    // Default = 'library' (blueprint + composition + component library — the new,
    // gate-by-construction path). 'freeform' = the legacy free-form HTML engine,
    // preserved BYTE-FOR-BYTE (custom/Pro). Only an explicit 'freeform' opts out.
    const mode = website.theme?.generationMode === 'freeform' ? 'freeform' : 'library'

    if (mode === 'freeform') {
      // FREEFORM (UNCHANGED) — branch on siteType exactly as before:
      // 'landing' → proven single-page flow; 'multipage' → plan → per-page gen → gate.
      if (website.siteType === 'multipage') {
        return await generateMultipage(ctx, ds, website)
      }
      return await generateLanding(ctx, ds, website)
    }

    // LIBRARY (DEFAULT) — blueprint → composition → renderComponent → gate.
    return await generateLibrarySite(userId, ctx, ds, website)
  } catch (e) {
    // Belt-and-braces: nothing escapes this orchestrator as a throw.
    console.warn('[generateHtmlSite] soft-fail:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'generation_failed' }
  }
}

// ---------------------------------------------------------------------------
// LIBRARY MODE (DEFAULT, #builder-5a) — blueprint → composition → renderComponent
// → assemble → gate → fallback-self-repair → multilang.
//
// Flow (Bölüm 4.7 / 4.8 / 5):
//   1. industry template select (infer from category/siteType/instruction).
//   2. seed = website.id + existing version count (sites differ; regen varies).
//   3. blueprintGenerator(ctx, template, ds, seed) → SiteBlueprint (Opus, builder-3;
//      AI invalid/no-key → deterministic fallback blueprint via the validator).
//   4. compose + render each page's blocks → body HTML (librarySiteShared, pure).
//   5. per page: resolveImagePlaceholders → gateSiteHtml. On gate fail → ONE
//      self-repair: re-render the SAME page from the deterministic FALLBACK
//      blueprint (all-SABİT library components → guaranteed gate-pass) + re-gate;
//      still failing → ok:false (the route refunds).
//   6. multilang: translate each gated default-locale page for every extra locale
//      (best-effort, structure preserved — same as the freeform path).
//
// Soft-fail: any throw is caught by the top-level generateHtmlSite try/catch.
// ---------------------------------------------------------------------------

/** Stock image resolver for {{IMG:query}} — mirrors htmlGenerateShared.makeStockResolver. */
function makeStockResolver(): (query: string) => Promise<string> {
  const stockReady = isStockReady()
  return async (query: string): Promise<string> => {
    const q = (query || '').trim()
    if (!q || !stockReady) return ''
    try {
      const img = await pickStockImage(q)
      return img?.url ?? ''
    } catch {
      return ''
    }
  }
}

/** SEO for a library page from its slug/pageRole (brand-derived, escaped later). */
function deriveLibraryPageSeo(
  ctx: CodegenContext,
  page: RenderedLibraryPage,
  siteSeo: { title: string; description: string },
): { title: string; description: string } {
  const brand = (ctx.brandName || '').trim() || (ctx.locale === 'en' ? 'Your Brand' : 'Markanız')
  if (page.pageRole === 'home' || page.slug === 'home') return siteSeo
  // A short, human page label from the slug (the blueprint slugs are url-safe TR/EN).
  const label = page.slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
  const title = label ? clamp(`${label} — ${brand}`, 70) : siteSeo.title
  return { title, description: siteSeo.description }
}

/**
 * Render a blueprint's pages into GATED WebsitePageInput[] (default locale only).
 * Each page is composed → rendered → image-resolved → gated. The per-page gate
 * outcome drives the caller's all-or-nothing / self-repair decision.
 *
 * @returns { ok:true, pages } when EVERY page gates clean, else { ok:false, reason, failedSlug }.
 */
async function renderAndGateBlueprint(
  ctx: CodegenContext,
  ds: DesignSystem,
  website: Website,
  blueprint: SiteBlueprint,
  seed: string,
  resolveImg: (query: string) => Promise<string>,
  siteSeo: { title: string; description: string },
): Promise<
  | { ok: true; pages: WebsitePageInput[] }
  | { ok: false; reason: string; failedSlug: string }
> {
  const rendered = renderBlueprintToPages(blueprint, ds, seed, renderComponent, {
    mobileMenuAnim: website.theme?.mobileMenuAnim ?? undefined,
    defaultLocale: website.defaultLocale,
  })
  if (rendered.length === 0) {
    return { ok: false, reason: 'generation_failed', failedSlug: '' }
  }

  const out: WebsitePageInput[] = []
  for (const page of rendered) {
    // {{IMG:query}} → real stock URL (existing resolver; falls back to a safe image).
    const withImages = await resolveImagePlaceholders(page.html, resolveImg)
    // Publish gate (builder-4 invariants). Library components pass by construction.
    const gate = gateSiteHtml(withImages)
    if (gate.ok === false) {
      return { ok: false, reason: gate.reason, failedSlug: page.slug }
    }
    out.push({
      locale: website.defaultLocale,
      slug: page.slug,
      pageRole: coercePageRole(page.pageRole),
      sections: [],
      seo: deriveLibraryPageSeo(ctx, page, siteSeo),
      orderIndex: page.orderIndex,
      html: gate.html,
      format: 'html',
    })
  }
  return { ok: true, pages: out }
}

async function generateLibrarySite(
  userId: string,
  ctx: CodegenContext,
  ds: DesignSystem,
  website: Website,
): Promise<GenerateHtmlSiteResult> {
  // 1. Industry template — inferred from the site's category / siteType / instruction.
  const templateKey = inferIndustryTemplateKey({
    category: website.category,
    siteType: website.siteType,
    instruction: ctx.instruction,
  })

  // 2. Seed — website.id + existing version count (different sites differ; a
  //    regeneration of the SAME site can vary). Best-effort version count; soft-fail → 0.
  let versionCount = 0
  try {
    versionCount = (await listVersions(userId, website.id)).length
  } catch {
    versionCount = 0
  }
  const seed = deriveSiteSeed(website.id, versionCount)

  // 3. Blueprint — Opus selects components from the template pool + writes content
  //    ({{IMG:}} placeholders). Generator failure/invalid → deterministic fallback
  //    blueprint (the validator handles that inside generateSiteBlueprint).
  const blueprint = await generateSiteBlueprint(ctx, ds, templateKey, seed)

  const siteSeo = deriveSeo(ctx)
  const resolveImg = makeStockResolver()

  // 4-5. Compose + render + image-resolve + gate every page.
  const first = await renderAndGateBlueprint(ctx, ds, website, blueprint, seed, resolveImg, siteSeo)

  let gatedPages: WebsitePageInput[]
  if (first.ok === true) {
    gatedPages = first.pages
  } else {
    // ONE self-repair — re-compose from the deterministic FALLBACK blueprint
    // (guaranteed-valid, all-SABİT library components → MUST pass the gate). No
    // second repair: if even the fallback fails, ok:false (the route refunds).
    console.warn(
      `[generateHtmlSite] library gate fail (slug="${first.failedSlug}"): ${first.reason} — self-repair via fallback blueprint`,
    )
    const fallback = buildFallbackBlueprint(ds, templateKey, ctx.locale, seed, ctx.preferredHero)
    const repaired = await renderAndGateBlueprint(ctx, ds, website, fallback, seed, resolveImg, siteSeo)
    if (repaired.ok === false) {
      console.warn(
        `[generateHtmlSite] library fallback gate fail (slug="${repaired.failedSlug}"): ${repaired.reason}`,
      )
      return { ok: false, reason: repaired.reason }
    }
    gatedPages = repaired.pages
  }

  // Home MUST be present (the blueprint validator guarantees home-first).
  const home = gatedPages.find((p) => p.slug === 'home') ?? gatedPages[0]
  if (!home || gatedPages.length === 0) {
    return { ok: false, reason: 'generation_failed' }
  }

  // 6. Multi-language — translate each gated default-locale page for every extra
  //    locale (best-effort, structure preserved; per-page fall-back on a miss).
  const extraPages = await buildExtraLocalePages(ctx, website, gatedPages)

  const designVars = await toDesignVars(ds)
  return { ok: true, page: home, pages: [...gatedPages, ...extraPages], designVars }
}

// ---------------------------------------------------------------------------
// MULTI-LANGUAGE — translate the default-locale pages for every EXTRA locale.
//
// The default-locale page(s) are generated ONCE (Opus). For each additional
// locale we produce a TRANSLATED copy of each page — same slug/pageRole/orderIndex/
// html STRUCTURE, only the human-readable text + SEO is translated (cheap Sonnet
// call, structure preserved). Best-effort: if translation OR the re-gate fails for
// a page+locale, we FALL BACK to the original default-locale html (so the locale
// still renders, just untranslated) — a miss NEVER fails the whole generation.
// Returns ONLY the extra-locale pages (the caller already has the default ones).
// ---------------------------------------------------------------------------

/**
 * @param ctx           Stage-0 context
 * @param website       the Website (for defaultLocale + locales)
 * @param defaultPages  the gated default-locale pages (already built)
 * @returns the translated pages for every extra locale (default-locale pages NOT included)
 */
async function buildExtraLocalePages(
  ctx: CodegenContext,
  website: Website,
  defaultPages: WebsitePageInput[],
): Promise<WebsitePageInput[]> {
  const from = website.defaultLocale
  const extraLocales = (website.locales || []).filter(
    (l, i, arr) => l && l !== from && arr.indexOf(l) === i,
  )
  if (extraLocales.length === 0) return []

  const out: WebsitePageInput[] = []

  for (const locale of extraLocales) {
    for (const page of defaultPages) {
      const sourceHtml = page.html ?? ''
      let html = sourceHtml // fall back to original (untranslated) by default
      let seo = page.seo ?? { title: '', description: '' }

      // 1. Translate the page HTML (structure preserved). On any miss → keep original.
      try {
        const translated = await translatePageHtml(sourceHtml, from, locale)
        // Re-gate: structure is preserved so it should pass; if it doesn't, keep the
        // original (already-gated) html for this locale rather than ship something broken.
        const gate = gateSiteHtml(translated)
        if (gate.ok === true) {
          html = gate.html
        } else {
          console.warn(
            `[generateHtmlSite] translated page failed re-gate (slug="${page.slug}", locale="${locale}"): ${gate.reason} — falling back to default-locale html`,
          )
        }
      } catch (e) {
        console.warn(
          `[generateHtmlSite] translation failed (slug="${page.slug}", locale="${locale}"):`,
          e instanceof Error ? e.message : e,
        )
        // html stays = sourceHtml (the default-locale, already-gated copy).
      }

      // 2. Translate the SEO title + description (short). On any miss → keep originals.
      try {
        const [title, description] = await translateStrings(
          [seo.title ?? '', seo.description ?? ''],
          from,
          locale,
        )
        seo = { title: title || seo.title, description: description || seo.description }
      } catch (e) {
        console.warn(
          `[generateHtmlSite] seo translation failed (slug="${page.slug}", locale="${locale}"):`,
          e instanceof Error ? e.message : e,
        )
      }

      out.push({
        locale,
        slug: page.slug,
        pageRole: page.pageRole,
        sections: [],
        seo,
        orderIndex: page.orderIndex,
        html,
        format: 'html',
      })
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// LANDING (single-page) — UNCHANGED behavior (one home page, anchor nav).
// ---------------------------------------------------------------------------

async function generateLanding(
  ctx: CodegenContext,
  ds: Awaited<ReturnType<typeof generateDesignSystem>>,
  website: Website,
): Promise<GenerateHtmlSiteResult> {
  // First-pass body HTML. Throws on no-key / call failure / empty output.
  let body: string
  try {
    body = await generateHomePageHtml(ctx, ds)
  } catch (e) {
    console.warn('[generateHtmlSite] generation failed:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'generation_failed' }
  }

  // Publish gate.
  let gate = gateSiteHtml(body)

  // ONE self-repair attempt — targeted, reason-specific. No second repair.
  if (gate.ok === false) {
    const reason = gate.reason
    try {
      const repaired = await repairHomePageHtml(ctx, ds, body, reason)
      gate = gateSiteHtml(repaired)
    } catch (e) {
      console.warn('[generateHtmlSite] self-repair failed:', e instanceof Error ? e.message : e)
      return { ok: false, reason }
    }
    if (gate.ok === false) {
      return { ok: false, reason: gate.reason }
    }
  }

  // Gate success → build the home WebsitePageInput + return designVars.
  const seo = deriveSeo(ctx)
  const page: WebsitePageInput = {
    locale: website.defaultLocale,
    slug: 'home',
    pageRole: 'home',
    sections: [],
    seo,
    orderIndex: 0,
    html: gate.html,
    format: 'html',
  }

  // Multi-language: append a TRANSLATED copy of the home page for every extra
  // locale (best-effort, structure preserved; falls back to original on a miss).
  const extraPages = await buildExtraLocalePages(ctx, website, [page])

  const designVars = await toDesignVars(ds)
  return { ok: true, page, pages: [page, ...extraPages], designVars }
}

// ---------------------------------------------------------------------------
// MULTIPAGE — plan → per-page generation (shared nav) → per-page gate.
//
// All-or-nothing gate policy: the home page MUST pass; if ANY page fails after
// its ONE self-repair, the WHOLE run fails (the route refunds). This keeps the
// shared nav consistent — we never ship a nav link to a page that does not
// exist. The failing page's slug is logged.
// ---------------------------------------------------------------------------

async function generateMultipage(
  ctx: CodegenContext,
  ds: Awaited<ReturnType<typeof generateDesignSystem>>,
  website: Website,
): Promise<GenerateHtmlSiteResult> {
  // 1. Plan the sitemap (one Opus call). Always returns a valid bounded list
  //    (home first + contact present; 3..6 pages; unique url-safe slugs).
  const plan: PlannedPage[] = await planSitePages(ctx)

  // 2. Shared nav list (slug + label, in order) handed to every page so the
  //    header/footer nav is identical site-wide.
  const navPages: NavPage[] = plan.map((p) => ({ slug: p.slug, navLabel: p.navLabel }))

  const siteSeo = deriveSeo(ctx)
  const pages: WebsitePageInput[] = []

  // 3. Generate + gate EACH page (one self-repair each). Sequential keeps the
  //    site well under the 60s route budget per page and avoids hammering the API.
  for (const planned of plan) {
    const pageSpec: PageSpec = {
      slug: planned.slug,
      title: planned.title,
      purpose: planned.purpose,
      role: planned.role,
    }

    // First pass.
    let body: string
    try {
      body = await generatePageHtml(ctx, ds, pageSpec, navPages)
    } catch (e) {
      console.warn(
        `[generateHtmlSite] multipage gen failed (slug="${planned.slug}"):`,
        e instanceof Error ? e.message : e,
      )
      return { ok: false, reason: 'generation_failed' }
    }

    // Gate + ONE self-repair.
    let gate = gateSiteHtml(body)
    if (gate.ok === false) {
      const reason = gate.reason
      try {
        const repaired = await repairPageHtml(ctx, ds, pageSpec, navPages, body, reason)
        gate = gateSiteHtml(repaired)
      } catch (e) {
        console.warn(
          `[generateHtmlSite] multipage self-repair failed (slug="${planned.slug}"):`,
          e instanceof Error ? e.message : e,
        )
        return { ok: false, reason }
      }
      if (gate.ok === false) {
        // All-or-nothing: any page failing fails the whole run (route refunds).
        console.warn(
          `[generateHtmlSite] multipage gate fail (slug="${planned.slug}"): ${gate.reason}`,
        )
        return { ok: false, reason: gate.reason }
      }
    }

    pages.push({
      locale: website.defaultLocale,
      slug: planned.slug,
      pageRole: coercePageRole(planned.role),
      sections: [],
      seo: derivePageSeo(ctx, planned, siteSeo),
      orderIndex: planned.orderIndex,
      html: gate.html,
      format: 'html',
    })
  }

  // Home MUST be present + passed (it is the first planned page and is gated above).
  const home = pages.find((p) => p.slug === 'home') ?? pages[0]
  if (!home || pages.length === 0) {
    return { ok: false, reason: 'generation_failed' }
  }

  // Multi-language: append TRANSLATED copies of EVERY page for each extra locale
  // (best-effort, structure preserved; per-page fall-back on a miss). The default-
  // locale pages above are the source of truth and are returned unchanged.
  const extraPages = await buildExtraLocalePages(ctx, website, pages)

  const designVars = await toDesignVars(ds)
  return { ok: true, page: home, pages: [...pages, ...extraPages], designVars }
}
