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
 *   5c. builder: inline site runtime + inline BUILDER runtime (yoai-builder-runtime.js)
 *               — the visual-edit select layer (#builder-8b). BUILDER-ONLY: never on
 *               serve, never on a public/new-tab preview (those use 'serve'/'preview').
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

// cheerio — used for a PRECISE, safe post-sanitize attribute injection on the
// already-sanitized (trusted) body. Avoids a fragile regex on the form tag.
const { load: cheerioLoad } = await import('cheerio')

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
// MULTIPAGE nav link rewriting — data-yoai-href="<slug>" → real href
//
// Multipage generation emits shared header/footer nav as
//   <a data-yoai-href="<targetSlug>">NavLabel</a>
// because the generator does NOT know the final URL base (subdomain serve vs.
// owner preview vs. custom domain). We resolve those to a REAL href here, at
// assembly time, from a validated linkBase.
//
// SAFETY: only slugs matching the url-safe pattern (lowercase ascii + hyphen)
// are ever turned into a path — exactly the shape validatePagePlan guarantees.
// Anything else falls back to the home href, so no arbitrary attacker text can
// be injected into an href. The home slug ('home' or '') maps to the base.
//
// SLUG-SET-AWARE: callers that know the site's page list pass `knownSlugs` (the
// validated slugs of pages that ACTUALLY exist, INCLUDING home). A data-yoai-href
// is then resolved to its real path ONLY if the slug is BOTH url-safe AND a known
// page. A url-safe-but-unknown slug (e.g. the model emitted "blog" but no blog
// page was planned) resolves to the HOME base — a stray nav link goes home instead
// of 404ing on a page that does not exist. If `knownSlugs` is omitted (back-compat
// callers that don't have the list), the shape-only check is used.
//
// SCOPE / TODO (custom domain): the nav base differs when a site is served from
// a CUSTOM DOMAIN (theme.customDomain) — there the pages live at the ROOT
// ('/', '/<slug>') rather than under '/s/<subdomain>'. This module implements
// the reliable SUBDOMAIN serve base ('/s/<subdomain>') + the PREVIEW base
// ('/website-preview/<id>?slug='). When custom-domain serving is wired up, pass
// linkBase='' (root) with navMode='path' so home→'/' and slug 'x'→'/x'. The
// resolveNavHref logic below already supports an empty base (returns '/' for
// home, '/<slug>' for sub-pages) — only the caller (a custom-domain route) needs
// to pass the right linkBase. No change to this function is required for that.
// ---------------------------------------------------------------------------

const HOME_SLUG = 'home'
const SAFE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Resolve a single nav slug → a real href, given the link base + nav mode.
 *
 * @param {string} slug      the data-yoai-href value (a page slug, '' or 'home' = home)
 * @param {object} opts
 * @param {string} opts.linkBase   base path (serve: '/s/<sub>'; preview: '/website-preview/<id>')
 * @param {'path'|'query'} opts.navMode  'path' (serve: base/slug) | 'query' (preview: base?slug=slug)
 * @param {string} [opts.localeQuery]    extra query string for preview (e.g. '&locale=tr'); query mode only
 * @param {string[]} [opts.knownSlugs]   slugs of pages that ACTUALLY exist (incl. home). When provided,
 *                                        a url-safe slug only resolves to its path if it is in this set;
 *                                        url-safe-but-unknown → HOME base (no 404). Omitted → shape-only.
 * @returns {string} a safe resolved href
 */
export function resolveNavHref(slug, { linkBase, navMode, localeQuery = '', knownSlugs } = {}) {
  const base = typeof linkBase === 'string' ? linkBase : ''
  const s = typeof slug === 'string' ? slug.trim() : ''
  const isHome = s === '' || s === HOME_SLUG
  // Only a validated url-safe slug becomes a path; anything else → home (no injection).
  const shapeSafe = !isHome && SAFE_SLUG_RE.test(s)
  // SLUG-SET-AWARE: when a known-slug list is supplied, the slug must ALSO be a
  // real page. A url-safe-but-unknown slug (model emitted a page that does not
  // exist) is treated as NOT resolvable → falls back to the home base (no 404).
  // When no list is supplied, keep the legacy shape-only behaviour (back-compat).
  const knownSet = Array.isArray(knownSlugs) ? knownSlugs : null
  const safe = shapeSafe && (knownSet === null || knownSet.includes(s))

  if (navMode === 'query') {
    // Preview: the iframe page reads ?slug=<slug> (server component re-renders).
    const slugVal = isHome ? HOME_SLUG : safe ? s : HOME_SLUG
    return `${base}?slug=${slugVal}${localeQuery || ''}`
  }

  // Default 'path' mode (subdomain serve): base for home, base/slug otherwise.
  if (isHome) return base || '/'
  if (!safe) return base || '/'
  // Avoid a double slash if base already ends with '/'.
  return base.endsWith('/') ? `${base}${s}` : `${base}/${s}`
}

// ---------------------------------------------------------------------------
// CONTACT FORM action wiring — SERVER fully owns the submit URL (CRITICAL #3)
//
// The submit URL is NEVER author-able by the AI. `data-yoai-form-action` is OFF
// the sanitizer allowlist (sanitizeAllowlist.mjs → form attrs), so ANY value the
// AI emits — single-quoted, double-quoted OR unquoted — is STRIPPED by sanitize.
// The SERVING layer then injects the trusted, same-origin action HERE, AFTER
// sanitize, on the already-sanitized (trusted) body — so the ONLY
// `data-yoai-form-action` that can ever be present is the server's.
//
// This replaces the old PRE-sanitize `rewriteFormAction`, whose double-quote-only
// cleanup regex (`/\sdata-yoai-form-action="[^"]*"/gi`) missed single-quoted /
// unquoted AI values; the server then appended a SECOND same-named attribute and
// sanitize-html kept the FIRST (the AI's evil one), exfiltrating visitor data to
// an attacker URL (CSP connect-src 'self' was the only mitigation).
//
// SAFETY:
//   - Runs POST-sanitize on a TRUSTED body (no AI action survives to here).
//   - actionPath is a server-controlled same-origin path (e.g. '/s/<sub>/lead'),
//     never attacker text; it is attribute-escaped before injection.
//   - Precise insertion via cheerio — only `[data-yoai-form]` elements get the
//     attr; any (impossible-after-sanitize) pre-existing value is removed first,
//     so the result is exactly ONE server action per form (idempotent).
//   - No-op when actionPath is empty/undefined (preview/thumb → the runtime falls
//     back to OPTIMISTIC success: reveal, no real fetch).
// ---------------------------------------------------------------------------

/**
 * Inject the SERVER-OWNED `data-yoai-form-action="<actionPath>"` on every
 * `[data-yoai-form]` element of an ALREADY-SANITIZED body. POST-sanitize only.
 * No-op when actionPath is empty/undefined (preview/thumb → optimistic success).
 *
 * @param {string} cleanHtml    sanitized (trusted) body inner HTML
 * @param {string} actionPath   same-origin lead path (e.g. '/s/<sub>/lead')
 * @returns {string}
 */
export function injectFormAction(cleanHtml, actionPath) {
  if (typeof cleanHtml !== 'string' || !cleanHtml) return cleanHtml || ''
  if (!actionPath || typeof actionPath !== 'string') return cleanHtml
  // Only inject a STRICT SAME-ORIGIN path: a single '/' then a non-'/'-non-'\\' char
  // (or bare '/'). Rejects protocol-relative '//evil' / '/\\evil' and absolute URLs.
  // Defense-in-depth: the caller already passes a server path (e.g. '/s/<sub>/lead').
  const ap = actionPath.trim()
  const sameOrigin = ap === '/' || (ap.length > 1 && ap[0] === '/' && ap[1] !== '/' && ap[1] !== '\\')
  if (!sameOrigin) return cleanHtml
  const forms = cleanHtml.includes('data-yoai-form')
  if (!forms) return cleanHtml
  // Parse the trusted body as a fragment (no <html>/<head>/<body> wrappers added
  // to the output) and set the attr precisely on every form marker element.
  const $ = cheerioLoad(cleanHtml, null, false)
  const targets = $('[data-yoai-form]')
  if (targets.length === 0) return cleanHtml
  targets.each((_i, el) => {
    // Belt: drop any stray same-named attr (none can survive sanitize) then set ours.
    $(el).removeAttr('data-yoai-form-action')
    $(el).attr('data-yoai-form-action', actionPath)
  })
  return $.html()
}

/**
 * Rewrite every `<a data-yoai-href="<slug>">` in `html` so it gains a real
 * `href="<resolved>"`. Pure + deterministic. The data-yoai-href attribute is
 * KEPT (harmless, useful for re-rewriting a preview→serve switch).
 *
 * If `linkBase` is empty/undefined (single-page 'landing' path) the html is
 * returned unchanged — landing pages never contain data-yoai-href.
 *
 * `opts.knownSlugs` (when supplied) makes the rewrite slug-set-aware: a
 * data-yoai-href to a page that does not exist resolves to the home base.
 *
 * @param {string} html
 * @param {object} opts  see resolveNavHref (linkBase, navMode, localeQuery, knownSlugs)
 * @returns {string}
 */
export function rewriteNavLinks(html, opts) {
  if (typeof html !== 'string' || !html) return html || ''
  if (!opts || !opts.linkBase) return html
  // Match an <a ...> open tag carrying data-yoai-href="..." and inject/replace href.
  // We only touch the opening tag; the slug value is read from the attribute.
  return html.replace(/<a\b([^>]*?)\sdata-yoai-href="([^"]*)"([^>]*)>/gi, (full, pre, slug, post) => {
    const resolved = escapeAttr(resolveNavHref(slug, opts))
    // Drop any pre-existing href in the surrounding attrs to avoid duplicates,
    // then add our resolved one. (Generator is told not to emit href alongside.)
    const cleanPre = pre.replace(/\shref="[^"]*"/i, '')
    const cleanPost = post.replace(/\shref="[^"]*"/i, '')
    return `<a${cleanPre} data-yoai-href="${escapeAttr(slug)}" href="${resolved}"${cleanPost}>`
  })
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
 * @param {'serve'|'preview'|'builder'} args.mode — serve: external runtime; preview: inline site
 *                                           runtime; builder: inline site runtime + inline BUILDER
 *                                           runtime (visual-edit select layer; builder canvas ONLY).
 * @param {string} [args.linkBase]        — MULTIPAGE: base path for data-yoai-href nav rewrite.
 *                                           serve:   '/s/<subdomain>' (path mode → base/slug)
 *                                           preview: '/website-preview/<id>' (query mode → base?slug=…)
 *                                           Absent/empty → no rewrite (landing single page).
 * @param {'path'|'query'} [args.navMode] — how to build the nav href (default 'path').
 * @param {string} [args.localeQuery]     — extra query for preview nav (e.g. '&locale=tr'); query mode only.
 * @param {string[]} [args.knownSlugs]    — MULTIPAGE: slugs of pages that ACTUALLY exist (incl. home).
 *                                          Makes the nav rewrite slug-set-aware: a data-yoai-href to a
 *                                          non-existent page resolves to the home base (no 404). Omitted
 *                                          (back-compat) → shape-only url-safe check, as before.
 * @param {string} [args.formActionBase]  — CONTACT FORM: same-origin lead path injected as
 *                                          data-yoai-form-action on every <form data-yoai-form>
 *                                          (e.g. '/s/<sub>/lead'). Set ONLY in real serve mode;
 *                                          omitted in preview/thumb → runtime optimistic success.
 * @returns {Promise<string>}             — Full HTML document string
 */
export async function assembleDocument({
  bodyHtml,
  designVars,
  seo,
  lang,
  fontHref,
  mode,
  linkBase,
  navMode,
  localeQuery,
  knownSlugs,
  formActionBase,
}) {
  // ── 0. MULTIPAGE nav rewrite (data-yoai-href → real href) ──────────────────
  // Runs BEFORE sanitize so the injected internal href is validated by the
  // sanitizer (defense-in-depth). No-op when linkBase is absent (landing page).
  const withNav = linkBase
    ? rewriteNavLinks(bodyHtml, {
        linkBase,
        navMode: navMode === 'query' ? 'query' : 'path',
        localeQuery: localeQuery || '',
        knownSlugs: Array.isArray(knownSlugs) ? knownSlugs : undefined,
      })
    : bodyHtml

  // ── 1. Sanitize ────────────────────────────────────────────────────────────
  // (CONTACT FORM action is injected AFTER sanitize — see step 1b. The AI can
  // NEVER author data-yoai-form-action: it is off the allowlist, so sanitize
  // strips any AI value here regardless of quoting.)
  const sanitized = sanitizeSiteHtml(withNav)

  // ── 1b. CONTACT FORM action wiring — SERVER-OWNED, POST-sanitize ────────────
  // Inject the trusted same-origin action on the already-sanitized (trusted) body.
  // SERVE mode only (formActionBase known, e.g. '/s/<sub>/lead'). PREVIEW/thumb:
  // no formActionBase → no injection → runtime optimistic success (no fetch).
  // This guarantees the ONLY data-yoai-form-action present is the server's path.
  const clean = formActionBase
    ? injectFormAction(sanitized, formActionBase)
    : sanitized

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
  // serve   → external same-origin /yoai-site-runtime.js (CSP script-src 'self'); no inline.
  // preview → inline the site runtime (srcdoc sandbox can't fetch external files).
  // builder → inline the site runtime AND the BUILDER runtime (visual-edit select layer,
  //           #builder-8b). BUILDER-ONLY: the public site, the `/s/` serve and the
  //           new-tab preview use 'serve'/'preview' and NEVER carry the builder runtime.
  let runtimeHtml
  if (mode === 'serve') {
    // External same-origin script — CSP script-src 'self' allows this.
    // NO inline <script> in serve mode (would be blocked by CSP).
    runtimeHtml = '<script src="/yoai-site-runtime.js" defer></script>'
  } else if (mode === 'builder') {
    // Builder canvas (sandboxed srcdoc, no same-origin) — inline BOTH runtimes so the
    // declarative site behaviours AND the postMessage select layer work without any
    // external fetch. The builder runtime only adds hover/select + postMessage; it
    // cannot reach the parent DOM (sandbox holds — no allow-same-origin).
    const siteSource = fs.readFileSync(
      path.join(process.cwd(), 'public', 'yoai-site-runtime.js'),
      'utf-8',
    )
    const builderSource = fs.readFileSync(
      path.join(process.cwd(), 'public', 'yoai-builder-runtime.js'),
      'utf-8',
    )
    runtimeHtml = `<script>${siteSource}</script>\n<script>${builderSource}</script>`
  } else {
    // preview mode: srcdoc cannot fetch external files, so inline the site runtime.
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
