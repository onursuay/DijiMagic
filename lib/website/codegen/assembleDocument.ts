/**
 * lib/website/codegen/assembleDocument.ts
 *
 * Thin typed wrapper around assembleDocument.mjs.
 *
 * The real assemble logic (single source of truth) lives in the .mjs file so that:
 *   - The verify script (scripts/verify-website-codegen.mjs) can import it
 *     directly with plain Node without any TS transpilation step.
 *   - App code imports THIS file and gets full TypeScript types.
 *
 * Pattern mirrors tailwindCompile.ts ↔ tailwindCompile.mjs.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import { assembleDocument as _assembleDocument } from './assembleDocument.mjs'

export interface AssembleDocumentArgs {
  /** AI-generated body inner HTML (will be sanitized) */
  bodyHtml: string
  /** CSS custom properties to embed as :root variables */
  designVars: Record<string, string>
  /** SEO metadata — AI-generated strings; will be HTML-escaped */
  seo: {
    title?: string
    description?: string
  }
  /** BCP47 language tag for <html lang="..."> (e.g. "tr", "en") */
  lang: string
  /** Google Fonts stylesheet href, e.g. "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" */
  fontHref?: string | null
  /**
   * serve:   <script src="/yoai-site-runtime.js" defer></script>
   *          (CSP script-src 'self' — NO inline scripts)
   * preview: runtime JS inlined into <script>...</script>
   *          (srcdoc iframe has no same-origin fetch)
   */
  mode: 'serve' | 'preview'
  /**
   * MULTIPAGE: base path used to rewrite shared-nav `data-yoai-href="<slug>"`
   * links into real hrefs. Absent/empty → no rewrite (single-page 'landing').
   *   serve:   '/s/<subdomain>'        (navMode 'path'  → base/slug)
   *   preview: '/website-preview/<id>' (navMode 'query' → base?slug=…)
   */
  linkBase?: string
  /** How to build the nav href. Default 'path' (serve). Preview uses 'query'. */
  navMode?: 'path' | 'query'
  /** Extra query string appended in 'query' (preview) nav mode, e.g. '&locale=tr'. */
  localeQuery?: string
}

/**
 * Assemble a full <!doctype html> document from AI-generated body HTML.
 *
 * Steps:
 *   1. sanitizeSiteHtml(bodyHtml)        — deny-by-default sanitizer
 *   2. compileSiteCss(clean, designVars) — per-site Tailwind JIT
 *   3. Build deterministic <head>        — charset, viewport, title, OG, fonts
 *   4. Embed CSS in <style>              — both modes
 *   5. Inject runtime                    — serve: external; preview: inlined
 *   6. Return full <!doctype html> string
 */
export const assembleDocument: (
  args: AssembleDocumentArgs,
) => Promise<string> = _assembleDocument as (
  args: AssembleDocumentArgs,
) => Promise<string>
