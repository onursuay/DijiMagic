/**
 * lib/website/codegen/types.ts
 * Shared types for the Web Site Yöneticisi code-generation engine.
 *
 * YAGNI: only types that are strictly needed today live here.
 * DesignSystem, CodegenContext, GateResult will be added by their respective tasks.
 */

/** Raw HTML string produced by the AI (body content only, no <html>/<head>). */
export type RawBodyHtml = string

/** Sanitized HTML string — safe to persist and render in the publish gate. */
export type SanitizedHtml = string

/**
 * Stage-0 context object assembled by buildCodegenContext.
 * Separates the user's trusted instruction from untrusted external data blocks.
 *
 * - `instruction`     : user's own initialInstructions text (trusted-ish intent channel)
 * - `untrustedBlocks` : array of wrapUntrusted(…) strings, one per external source
 *                       that exists (profile summary, intelligence, reference-URL scrapes)
 *                       — only sources that are actually present are included.
 */
export interface CodegenContext {
  brandName: string
  locale: string
  style?: string
  fontHref?: string | null
  logoUrl?: string | null
  /**
   * Mobil menü açılış animasyonu (perde yönü) — kullanıcı sihirbazda seçer.
   * 'left' (soldan), 'right' (sağdan), 'top' (yukarıdan). buildHtmlSystemPrompt
   * bunu `data-yoai-mobile-anim="<value>"` olarak basar. Tanımsız/geçersiz → 'left'.
   */
  mobileMenuAnim?: 'left' | 'right' | 'top'
  instruction: string
  untrustedBlocks: string[]
  /**
   * Veri önceliği = 'reference' seçildiğinde üretim prompt'larına eklenen TRUSTED
   * yönerge (referans verisinin nasıl kullanılacağını söyler; referans içeriğinin
   * KENDİSİ hâlâ untrustedBlocks içinde karantinada kalır — talimat olarak çalıştırılmaz).
   * buildPlanUserMessage (multipage sitemap) + buildHtmlUserMessage (sayfa HTML'i)
   * bu yönergeyi untrusted bloklardan ÖNCE basar → referans hem sayfa setini hem
   * içeriği gerçekten yönlendirir. 'manual'/auto modlarında boş/tanımsız (davranış değişmez).
   */
  referenceDirective?: string
}

/**
 * Stage-1 design system produced by Opus 4.8.
 * All token values are validated to be CSS-safe (no injection vectors).
 * These values become CSS custom properties in :root{ --x: VALUE }.
 *
 * Color freedom: the palette is UNCONSTRAINED by the YoAi dashboard's
 * amber/yellow ban — customer marketing sites may use any brand-appropriate
 * palette (amber/gold included). The ban in CLAUDE.md applies only to the
 * YoAi dashboard UI, not to generated site assets.
 */
export interface DesignSystem {
  palette: {
    /** Primary text color */
    ink: string
    /** Brand accent color — full color freedom including amber/gold */
    accent: string
    /** Soft/tinted accent for backgrounds, badges */
    accentSoft: string
    /** Page/card background */
    surface: string
    /** Text color on accent backgrounds */
    onAccent: string
    /** Secondary/muted text */
    muted?: string
    /** Default border color */
    border?: string
  }
  fonts: {
    /** Google Fonts @import href, or null if system fonts only */
    headingHref: string | null
    /** CSS font-family for headings (display/serif) */
    heading: string
    /** CSS font-family for body copy */
    body: string
  }
  /** Ordered spacing token values (CSS lengths, e.g. '0.5rem', '1rem') */
  spacingScale: string[]
  /** Ordered border-radius token values */
  radiusScale: string[]
  /** Box-shadow recipes as CSS value strings (multi-layer, color-tinted) */
  shadowRecipes: string[]
  /** CSS gradient value strings (linear/radial, layerable) */
  gradientRecipes: string[]
  motion: {
    /** CSS easing function (cubic-bezier or named keyword) */
    easing: string
    /** Animation durations in ms [micro, standard, emphasis] */
    durations: number[]
  }
}

// ---------------------------------------------------------------------------
// Stage 1.5 — SITE BLUEPRINT (Bölüm 4.7 / 5.1 of the master plan).
//
// The blueprint is the single decree of generation: it extends the multipage
// page plan (multipagePlan.ts) with PER-PAGE BLOCK assignments — each block is a
// named library component (componentKey ∈ the real registry) + a preset + a
// layout archetype + the editable content. The composition engine
// (compositionEngine.mjs) and renderer consume this; htmlGenerate / the
// deterministic fallback render each block from it.
//
// Anti-clone (Bölüm 5): two sites of the SAME industry differ because the
// composition engine picks a DIFFERENT subset/order of components+presets from
// the industry template's pool (seed-driven). The blueprint is the data those
// rules operate on.
// ---------------------------------------------------------------------------

/**
 * One renderable block on a page. The atom the composition engine orders and the
 * renderer (free-form Opus OR the deterministic fallback) materialises.
 */
export interface BlueprintBlock {
  /** Stable per-page id → data-yoai-id (e.g. 'b1'). Sequential within a page. */
  id: string
  /** Library registry key → data-yoai-block (e.g. 'hero.split-image'). MUST exist in COMPONENTS. */
  componentKey: string
  /**
   * Named composition variation of the component (e.g. 'split-image', 'tiers').
   * Defaults to the componentKey's suffix when the generator omits it; purely a
   * label that travels with the block (the renderer keys off componentKey).
   */
  presetKey: string
  /**
   * Layout archetype carried for the anti-generic post-checks (e.g.
   * 'asymmetric-split', 'full-bleed', 'card-grid', 'centered-stack', 'band').
   * The composition engine forbids two CONSECUTIVE blocks sharing an archetype.
   */
  archetype: string
  /**
   * The block's editable content — shaped to the component's contentFields.
   * Images stay as {{IMG:query}} placeholders (the model never invents URLs).
   */
  content: Record<string, unknown>
}

/**
 * A single page of the blueprint — mirrors a PlannedPage (multipagePlan) plus
 * the ordered block list that fills it.
 */
export interface BlueprintPage {
  /** BCP47-ish locale this page is authored in (the site default locale). */
  locale: string
  /** url-safe slug (home === 'home'); unique within the site. */
  slug: string
  /** Coerced PageRole (home | about | services | products | contact | …). */
  pageRole: string
  /** 0-based order in the sitemap (home === 0). */
  orderIndex: number
  /** The ordered blocks that compose this page (navbar … content … footer). */
  blocks: BlueprintBlock[]
}

/**
 * THE SITE BLUEPRINT — the enriched output of blueprintGenerator (replaces the
 * bare multipagePlan output downstream). One per generation.
 */
export interface SiteBlueprint {
  /** Chosen industry template key (industryTemplates.mjs) or null (free / unmatched). */
  industryTemplateKey: string | null
  /** Stage-1 DesignSystem (palette/font/spacing/motion) — half of the anti-clone signature. */
  designSystem: DesignSystem
  /** The site's pages, home first, each with its block list. */
  pages: BlueprintPage[]
}
