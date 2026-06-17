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
