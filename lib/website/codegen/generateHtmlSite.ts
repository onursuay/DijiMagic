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
import { buildCodegenContext } from './buildCodegenContext'
import { generateDesignSystem } from './designSystem'
import {
  generateHomePageHtml,
  repairHomePageHtml,
  generatePageHtml,
  repairPageHtml,
  toDesignVars,
  type NavPage,
  type PageSpec,
} from './htmlGenerate'
import { planSitePages, type PlannedPage } from './multipagePlan'
import { gateSiteHtml } from './renderGate'
import type { CodegenContext } from './types'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

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
 * @returns
 *   { ok:true, page, designVars } on a gated success, or
 *   { ok:false, reason }          on any failure (never throws).
 */
export async function generateHtmlSite(
  userId: string,
  website: Website,
): Promise<GenerateHtmlSiteResult> {
  try {
    // 1. Context (brand text + quarantined untrusted blocks).
    const ctx = await buildCodegenContext(userId, website)

    // 2. Design system — generated ONCE, shared across every page (consistent look).
    //    Already soft-fails to a safe default; never throws.
    const ds = await generateDesignSystem(ctx)

    // Branch on siteType: 'landing' keeps the proven single-page flow UNCHANGED;
    // 'multipage' runs the page-planning → per-page generation → per-page gate flow.
    if (website.siteType === 'multipage') {
      return await generateMultipage(ctx, ds, website)
    }
    return await generateLanding(ctx, ds, website)
  } catch (e) {
    // Belt-and-braces: nothing escapes this orchestrator as a throw.
    console.warn('[generateHtmlSite] soft-fail:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'generation_failed' }
  }
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

  const designVars = await toDesignVars(ds)
  return { ok: true, page, pages: [page], designVars }
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

  const designVars = await toDesignVars(ds)
  return { ok: true, page: home, pages, designVars }
}
