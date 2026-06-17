/**
 * lib/website/codegen/tailwindCompile.mjs
 *
 * Core implementation — plain ESM so both the TS app AND the verify script
 * (.mjs) can import it without a build/transpile step.
 *
 * Single source of truth: the real compile logic lives here once.
 *   - lib/website/codegen/tailwindCompile.ts  → thin typed wrapper (app code)
 *   - scripts/verify-website-codegen.mjs      → imports this file directly
 *
 * Uses the tailwindcss v3 + postcss Node API with an INLINE config per site:
 *   content: [{ raw: bodyHtml, extension: 'html' }]
 * This ensures each compiled CSS contains ONLY the classes used in that site's
 * HTML — no shared/global Tailwind config leaks in, no CDN needed at runtime.
 *
 * Note: compile takes ~200-500 ms per call. No caching here (YAGNI — a later
 * task handles theme.compiledCssVersion caching in Inngest).
 */

import { createRequire } from 'node:module'

// tailwindcss, postcss, autoprefixer are CommonJS packages.
// createRequire lets us load them from .mjs without issues.
const require = createRequire(import.meta.url)

const tailwindcss  = require('tailwindcss')
const postcss      = require('postcss')
const autoprefixer = require('autoprefixer')

/**
 * Build a :root{ ... } block from a designVars map.
 * Keys are CSS custom property names (e.g. "--brand-500"),
 * values are CSS values (e.g. "#059669").
 *
 * @param {Record<string, string>} designVars
 * @returns {string}  e.g. ":root {\n  --brand-500: #059669;\n}\n"
 */
function buildRootBlock(designVars) {
  if (!designVars || Object.keys(designVars).length === 0) return ''
  const declarations = Object.entries(designVars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')
  return `:root {\n${declarations}\n}\n`
}

/**
 * Compile minimal Tailwind CSS for a single site.
 *
 * @param {string} bodyHtml      — Raw HTML of the generated marketing page body
 * @param {Record<string, string>} designVars — CSS custom properties to prepend as :root{ }
 * @returns {Promise<string>}    — Full CSS string (designVars :root block + Tailwind output)
 */
export async function compileSiteCss(bodyHtml, designVars) {
  const html = typeof bodyHtml === 'string' ? bodyHtml : ''

  // Inline per-site Tailwind config — NEVER imports the project tailwind.config
  const inlineConfig = {
    content: [{ raw: html, extension: 'html' }],
    corePlugins: { preflight: true },
    theme: { extend: {} },
  }

  const result = await postcss([
    tailwindcss(inlineConfig),
    autoprefixer,
  ]).process('@tailwind base;\n@tailwind utilities;', { from: undefined })

  const rootBlock = buildRootBlock(designVars ?? {})
  return rootBlock + result.css
}
