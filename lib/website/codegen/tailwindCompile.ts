/**
 * lib/website/codegen/tailwindCompile.ts
 *
 * Thin typed wrapper around tailwindCompile.mjs.
 *
 * The real compile logic (single source of truth) lives in the .mjs file so that:
 *   - The verify script (scripts/verify-website-codegen.mjs) can import it
 *     directly with plain Node without any TS transpilation step.
 *   - App code imports THIS file and gets full TypeScript types.
 *
 * Pattern mirrors sanitizeHtml.ts ↔ sanitizeAllowlist.mjs.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import { compileSiteCss as _compileSiteCss } from './tailwindCompile.mjs'

/**
 * Compile minimal per-site Tailwind CSS from the actual classes used in bodyHtml.
 *
 * Uses the tailwindcss v3 + postcss Node API with an INLINE config (not the
 * project tailwind.config) so each site gets isolated, minimal CSS with no
 * shared dashboard styles leaking in.
 *
 * Prepends a `:root { ...designVars }` block to the compiled output.
 *
 * Note: takes ~200-500 ms per call — intended to run in Inngest, not per-request.
 *
 * @param bodyHtml    Raw HTML of the generated marketing page body
 * @param designVars  CSS custom property map to embed as :root variables
 * @returns           Full CSS string ready to embed in a <style> tag
 */
export const compileSiteCss: (
  bodyHtml: string,
  designVars: Record<string, string>,
) => Promise<string> = _compileSiteCss as (
  bodyHtml: string,
  designVars: Record<string, string>,
) => Promise<string>
