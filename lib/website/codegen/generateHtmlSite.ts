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

import type { Website, WebsitePageInput } from '@/lib/website/types'
import { buildCodegenContext } from './buildCodegenContext'
import { generateDesignSystem } from './designSystem'
import { generateHomePageHtml, repairHomePageHtml, toDesignVars } from './htmlGenerate'
import { gateSiteHtml } from './renderGate'
import type { CodegenContext } from './types'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type GenerateHtmlSiteResult =
  | { ok: true; page: WebsitePageInput; designVars: Record<string, string> }
  | { ok: false; reason: string }

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

    // 2. Design system — already soft-fails to a safe default; never throws.
    const ds = await generateDesignSystem(ctx)

    // 3. First-pass body HTML. Throws on no-key / call failure / empty output.
    let body: string
    try {
      body = await generateHomePageHtml(ctx, ds)
    } catch (e) {
      console.warn('[generateHtmlSite] generation failed:', e instanceof Error ? e.message : e)
      return { ok: false, reason: 'generation_failed' }
    }

    // 4. Publish gate.
    let gate = gateSiteHtml(body)

    // 5. ONE self-repair attempt — targeted, reason-specific. No second repair.
    if (gate.ok === false) {
      const reason = gate.reason
      try {
        const repaired = await repairHomePageHtml(ctx, ds, body, reason)
        gate = gateSiteHtml(repaired)
      } catch (e) {
        console.warn('[generateHtmlSite] self-repair failed:', e instanceof Error ? e.message : e)
        // Repair attempt itself errored — report the ORIGINAL gate reason.
        return { ok: false, reason }
      }
      if (gate.ok === false) {
        return { ok: false, reason: gate.reason }
      }
    }

    // 6. Gate success → build the home WebsitePageInput + return designVars.
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
    return { ok: true, page, designVars }
  } catch (e) {
    // Belt-and-braces: nothing escapes this orchestrator as a throw.
    console.warn('[generateHtmlSite] soft-fail:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'generation_failed' }
  }
}
