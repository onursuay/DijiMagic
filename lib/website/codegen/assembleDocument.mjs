/**
 * lib/website/codegen/assembleDocument.mjs
 *
 * Core implementation — plain ESM so both the TS app AND the verify script
 * (.mjs) can import it without a build/transpile step.
 *
 * Single source of truth: the real assemble logic lives here once.
 *   - lib/website/codegen/assembleDocument.ts  → thin typed wrapper (app code)
 *   - scripts/verify-website-codegen.mjs       → imports this file directly
 *
 * Steps:
 *   1. sanitizeSiteHtml(bodyHtml) — reuse shared sanitizer core
 *   2. compileSiteCss(clean, designVars) — compile from SANITIZED html
 *   3. Build deterministic <head> (charset, viewport, title, og:*, fonts)
 *   4. Embed CSS in <style> (both modes)
 *   5a. serve:   <script src="/yoai-site-runtime.js" defer></script>  (CSP 'self')
 *   5b. preview: inline runtime JS from disk (srcdoc has no same-origin fetch)
 *   6. Return full <!doctype html> document
 *
 * CSP notes (serve mode):
 *   script-src 'self'        → external /yoai-site-runtime.js OK, inline script BLOCKED
 *   style-src  'self' 'unsafe-inline' → <style> tag in head OK
 */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Load sanitize-html (CommonJS package)
const sanitizeHtml = require('sanitize-html')

// Shared allowlist factory — single source of truth, no duplication
const { buildSanitizeOptions } = await import('./sanitizeAllowlist.mjs')
const sanitizeOptions = buildSanitizeOptions()

function sanitizeSiteHtml(bodyHtml) {
  if (!bodyHtml || typeof bodyHtml !== 'string') return ''
  return sanitizeHtml(bodyHtml, sanitizeOptions)
}

// Tailwind compile — single source of truth
const { compileSiteCss } = await import('./tailwindCompile.mjs')

// ---------------------------------------------------------------------------
// HTML escaping helpers
// ---------------------------------------------------------------------------

/**
 * Escape text content for use inside HTML element text nodes.
 * Prevents raw < > & from breaking the surrounding markup.
 */
function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Escape a string for use inside an HTML attribute value (double-quoted).
 * Escapes &, <, >, and " so the value cannot break out of the attribute.
 */
function escapeAttr(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble a full <!doctype html> document from AI-generated body HTML.
 *
 * @param {object} args
 * @param {string} args.bodyHtml          — AI-generated body inner HTML (unsanitized)
 * @param {Record<string,string>} args.designVars — CSS custom properties for :root
 * @param {{ title?: string; description?: string }} args.seo — SEO metadata (AI-generated; will be escaped)
 * @param {string} args.lang              — BCP47 language tag for <html lang="...">
 * @param {string|null|undefined} args.fontHref — Google Fonts stylesheet href (optional)
 * @param {'serve'|'preview'} args.mode   — serve: external runtime script; preview: inline runtime
 * @returns {Promise<string>}             — Full HTML document string
 */
export async function assembleDocument({
  bodyHtml,
  designVars,
  seo,
  lang,
  fontHref,
  mode,
}) {
  // ── 1. Sanitize ────────────────────────────────────────────────────────────
  const clean = sanitizeSiteHtml(bodyHtml)

  // ── 2. Compile Tailwind CSS from the sanitized HTML ───────────────────────
  const css = await compileSiteCss(clean, designVars ?? {})

  // ── 3. Prepare SEO values (escaped) ───────────────────────────────────────
  const safeLang = escapeAttr(lang || 'tr')

  // Title: escape as text node content (& < > escaped)
  const rawTitle = seo?.title || 'YoAi Site'
  const titleText = escapeHtml(rawTitle)

  // Description: escape as attribute value (& < > " escaped)
  const rawDesc = seo?.description || ''
  const descAttr = escapeAttr(rawDesc)

  // OG values: same escaping as attribute values
  const ogTitle = escapeAttr(rawTitle)
  const ogDesc = escapeAttr(rawDesc)

  // ── 4. Build <head> ────────────────────────────────────────────────────────
  // Google Fonts preconnect + optional stylesheet
  const fontsHtml = [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    fontHref
      ? `<link rel="stylesheet" href="${escapeAttr(fontHref)}">`
      : '',
  ]
    .filter(Boolean)
    .join('\n    ')

  const descMeta = descAttr
    ? `<meta name="description" content="${descAttr}">`
    : ''

  const head = `<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${titleText}</title>
    ${descMeta ? descMeta + '\n    ' : ''}<meta property="og:title" content="${ogTitle}">
    ${ogDesc ? `<meta property="og:description" content="${ogDesc}">\n    ` : ''}<meta property="og:type" content="website">
    ${fontsHtml}
    <style>
${css}
    </style>
  </head>`

  // ── 5. Runtime script ──────────────────────────────────────────────────────
  let runtimeHtml
  if (mode === 'serve') {
    // External same-origin script — CSP script-src 'self' allows this.
    // NO inline <script> in serve mode (would be blocked by CSP).
    runtimeHtml = '<script src="/yoai-site-runtime.js" defer></script>'
  } else {
    // preview mode: srcdoc cannot fetch external files, so inline the runtime.
    const runtimePath = path.join(process.cwd(), 'public', 'yoai-site-runtime.js')
    const runtimeSource = fs.readFileSync(runtimePath, 'utf-8')
    runtimeHtml = `<script>${runtimeSource}</script>`
  }

  // ── 6. Assemble full document ──────────────────────────────────────────────
  return `<!doctype html>
<html lang="${safeLang}">
  ${head}
  <body>
${clean}
${runtimeHtml}
  </body>
</html>`
}
