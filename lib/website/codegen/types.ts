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
  instruction: string
  untrustedBlocks: string[]
}
