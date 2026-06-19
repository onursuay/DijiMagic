/**
 * lib/website/codegen/renderGate.mjs
 *
 * Mandatory publish gate for AI-generated site HTML.
 *
 * Called BEFORE any generated site is persisted or published.
 * If the gate fails the caller must self-repair or fall back + refund credit.
 * A broken / empty / unsafe site NEVER goes live.
 *
 * Logic order (per task spec):
 *   1. Sanitize first — buildSanitizeOptions() (single source of truth)
 *   2. Parse clean HTML with cheerio
 *   3. Structural + safety checks on the sanitized HTML
 *   4. Return { ok: true, html: clean } or { ok: false, reason: '<stable_key>' }
 *
 * Reason strings are stable/short (self-repair logic keyed on them):
 *   parse_error       — cheerio threw during load
 *   no_h1             — zero <h1> elements found
 *   multiple_h1       — more than one <h1> found
 *   no_landmark       — no header / nav / main / footer
 *   too_large         — body byte size >= 220 KB
 *   forbidden_remnant — <script or on<word>= pattern present after sanitize
 *   suspicious_form   — a sensitive input (type password/file/hidden/image), a
 *                       form with an external native action/formaction, OR an
 *                       AI-authored data-yoai-form-action whose value is NOT a
 *                       same-origin path (exfiltration attempt — CRITICAL #3) in
 *                       the RAW input. ALSO backstopped post-sanitize: any
 *                       data-yoai-form-action that survives sanitize with a non-'/'
 *                       value (future allowlist regression) is rejected. The safe
 *                       contact form (text/email/tel + textarea + data-yoai-form,
 *                       no AI action) PASSES; the SERVER-injected same-origin
 *                       data-yoai-form-action="/…" PASSES. Defense-in-depth: the
 *                       sanitizer already coerces/strips these, but a page that
 *                       TRIED to collect credentials / smuggle a hidden payload /
 *                       POST or fetch cross-origin is rejected outright rather than
 *                       silently cleaned and published.
 *
 * QUALITY INVARIANTS (Plan Bölüm 14 — backstops against free-form/AI deviations
 * from the hard quality rules; CONSERVATIVE — they fail ONLY on a CLEAR violation
 * and NEVER on a valid library-composed page):
 *   mobile_menu_broken — a hamburger [data-yoai-nav-toggle="X"] exists but its
 *                        target [data-yoai-mobile-nav][id="X"] panel is missing or
 *                        empty (broken hamburger). A page with NO mobile nav at all
 *                        is OK (we never REQUIRE one). The SABİT navbar always pairs
 *                        the toggle with a populated #X panel, so it passes.
 *   stale_footer_year  — the FOOTER copyright (© / &copy; / Copyright + a 4-digit
 *                        year) names a year EARLIER than the current calendar year.
 *                        Scanned ONLY inside <footer> / [data-yoai-block^="footer"]
 *                        copyright text — NOT body content (so legitimate content
 *                        years never false-positive). A current-year or a range
 *                        ending in the current year (e.g. "2024-<currentYear>")
 *                        PASSES. The SABİT footer injects new Date().getFullYear().
 *   transparent_header — the header/navbar root (<header> or the top element with
 *                        [data-yoai-block^="navbar"]) is EXPLICITLY transparent:
 *                        bg-transparent OR a fully-transparent fill (bg-…/0). A
 *                        merely-absent bg class does NOT trigger it (too aggressive
 *                        / false-positive). The SABİT navbar is bg-[var(--surface)]
 *                        (opaque) → passes.
 */

import { createRequire } from 'node:module'

// Load sanitize-html (CommonJS) via createRequire
const require = createRequire(import.meta.url)
const sanitizeHtml = require('sanitize-html')

// Shared allowlist factory (single source of truth — no duplication)
import { buildSanitizeOptions } from './sanitizeAllowlist.mjs'

// cheerio — ESM named export
import { load } from 'cheerio'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BYTES = 220 * 1024 // 220 KB

// ---------------------------------------------------------------------------
// QUALITY-INVARIANT constants (Plan Bölüm 14 backstops)
// ---------------------------------------------------------------------------

/**
 * @type {RegExp} — a FOOTER copyright pattern: a © / &copy; / "Copyright" mark
 * followed (within a short, copyright-shaped run) by ONE OR MORE 4-digit years
 * possibly joined by a range separator (–, -, &ndash;, "to", …). Group 1 captures
 * the whole year-run so every year present can be inspected. The lead-in window
 * (up to ~24 non-'<' chars) keeps this anchored to an actual copyright line and
 * avoids matching arbitrary "© … <p>2019 was a great year</p>" prose far away.
 */
const FOOTER_COPYRIGHT_RE =
  /(?:©|&copy;|copyright)[^<]{0,24}?((?:19|20)\d{2}(?:\s*(?:[-–—]|&ndash;|&mdash;|\bto\b|,)\s*(?:19|20)\d{2})*)/i

/** @type {RegExp} — every 4-digit (19xx/20xx) year inside a captured year-run. */
const YEAR_RE = /(?:19|20)\d{2}/g

/**
 * @type {RegExp} — a CLEARLY transparent background on a navbar/header root.
 * Matches Tailwind `bg-transparent` (with class boundaries) OR a fully-transparent
 * opacity-suffixed bg utility (`bg-…/0`, `bg-[…]/0`) — both signal an intentional
 * see-through header. A MERELY-ABSENT bg class is NOT matched (conservative).
 */
const TRANSPARENT_BG_RE = /\bbg-transparent\b|\bbg-(?:\[[^\]]*\]|[a-z0-9-]*?)\/0\b/i

/** @type {RegExp} — defense-in-depth: <script remnant */
const SCRIPT_RE = /<script/i

/** @type {RegExp} — defense-in-depth: inline event handler attribute */
const INLINE_HANDLER_RE = /\son[a-z]+\s*=/i

/**
 * SUSPICIOUS FORM detection (runs on the RAW input, pre-sanitize) — per design §4.
 * A page that TRIED to collect credentials, smuggle a hidden payload, upload a
 * file, or POST cross-origin is REJECTED rather than silently cleaned. The safe
 * contact form (only text/email/tel inputs + <textarea> + data-yoai-form, no
 * action) never matches these.
 */

/** @type {RegExp} — an <input ... type="password|file|hidden|image" ...> (any attr order). */
const SENSITIVE_INPUT_RE =
  /<input\b[^>]*\btype\s*=\s*["']?\s*(?:password|file|hidden|image)\b/i

/** @type {RegExp} — a <form> carrying a native action=… (cross-origin / native POST). */
const FORM_ACTION_RE = /<form\b[^>]*\saction\s*=/i

/** @type {RegExp} — any element carrying a formaction=… submit-redirect surface. */
const FORMACTION_RE = /\sformaction\s*=/i

/**
 * Is `v` a SAME-ORIGIN path? Strictly: a single '/' followed by a non-'/'-non-'\\'
 * char (or the bare root '/'). A leading '//' or '/\\' is a PROTOCOL-RELATIVE
 * (cross-origin) URL — NOT same-origin. Anything not starting with '/' (http(s):,
 * mailto:, javascript:, relative, etc.) is also not same-origin.
 * @param {string} v
 * @returns {boolean}
 */
function isSameOriginPath(v) {
  const s = typeof v === 'string' ? v.trim() : ''
  if (s === '/') return true
  return s.length > 1 && s[0] === '/' && s[1] !== '/' && s[1] !== '\\'
}

/**
 * @type {RegExp} — an AI-authored `data-yoai-form-action` value, captured so the
 * value can be checked with isSameOriginPath. The submit URL is SERVER-OWNED: the
 * sanitizer strips any AI `data-yoai-form-action` (any quoting), and the server
 * injects a trusted same-origin path POST-sanitize. So an AI body carrying a value
 * that is NOT same-origin (single/double-quoted OR unquoted: https://evil, //evil,
 * /\evil, mailto:, javascript:, …) is a form-exfiltration attempt → reject.
 * A same-origin '/…' value is tolerated (cannot exfiltrate; the server re-owns it).
 * Group 1: double-quoted value; 2: single-quoted; 3: unquoted (to first space/>).
 */
const FORM_ACTION_VALUE_RE =
  /\bdata-yoai-form-action\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+))/gi

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Gate a generated site's body HTML before persisting/publishing.
 *
 * @param {string} bodyHtml — raw AI-generated body inner HTML
 * @returns {{ ok: true; html: string } | { ok: false; reason: string }}
 */
export function gateSiteHtml(bodyHtml) {
  // -------------------------------------------------------------------------
  // Step 0 — SUSPICIOUS FORM check on the RAW input (defense-in-depth, per §4).
  // A sensitive input (password/file/hidden/image) or a form with an external
  // action/formaction means the page TRIED to do something the contact-form
  // design forbids → reject outright rather than silently sanitize + publish.
  // The safe contact form (text/email/tel + textarea + data-yoai-form) never hits
  // these patterns. Run on raw input so it is caught even before the sanitizer
  // coerces it away.
  // -------------------------------------------------------------------------
  const raw = typeof bodyHtml === 'string' ? bodyHtml : ''
  if (
    SENSITIVE_INPUT_RE.test(raw) ||
    FORM_ACTION_RE.test(raw) ||
    FORMACTION_RE.test(raw)
  ) {
    return { ok: false, reason: 'suspicious_form' }
  }
  // CRITICAL #3 — AI tried to author a NON-same-origin form action (exfiltration).
  // Scan every data-yoai-form-action value (any quoting); reject if any is not a
  // strict same-origin path. A same-origin '/…' is tolerated (server re-owns it).
  FORM_ACTION_VALUE_RE.lastIndex = 0
  for (let m; (m = FORM_ACTION_VALUE_RE.exec(raw)); ) {
    const value = m[1] ?? m[2] ?? m[3] ?? ''
    if (!isSameOriginPath(value)) {
      return { ok: false, reason: 'suspicious_form' }
    }
  }

  // -------------------------------------------------------------------------
  // Step 1 — Sanitize first (shared options — single source of truth)
  // -------------------------------------------------------------------------
  const clean = sanitizeHtml(bodyHtml, buildSanitizeOptions())

  // -------------------------------------------------------------------------
  // Step 2 — Parse with cheerio (catch malformed / non-HTML input)
  // -------------------------------------------------------------------------
  let $
  try {
    $ = load(clean)
  } catch {
    return { ok: false, reason: 'parse_error' }
  }

  // -------------------------------------------------------------------------
  // Step 3 — Structural + safety checks (all run on sanitized HTML)
  // -------------------------------------------------------------------------

  // (a) FORM-ACTION same-origin backstop (CRITICAL #3 — exfiltration defense).
  // `data-yoai-form-action` is OFF the sanitizer allowlist, so an AI-authored
  // value (any quoting) is already STRIPPED by sanitize; the trusted same-origin
  // action is injected by the SERVER only AFTER this gate runs. Therefore, in the
  // gated (sanitized, pre-injection) body, NO data-yoai-form-action should survive
  // at all. If one DOES survive with a value that is NOT a same-origin path (i.e.
  // does not start with '/'), it means a future allowlist regression let an
  // attacker URL through — reject outright rather than risk exfiltrating visitor
  // data to it. A same-origin '/path' is tolerated (harmless); the server still
  // re-owns the action post-gate.
  const survivedActions = $('[data-yoai-form-action]')
  let externalFormAction = false
  survivedActions.each((_i, el) => {
    const v = String($(el).attr('data-yoai-form-action') ?? '')
    if (v.trim() !== '' && !isSameOriginPath(v)) externalFormAction = true
  })
  if (externalFormAction) {
    return { ok: false, reason: 'suspicious_form' }
  }

  // (b) Exactly ONE <h1>
  const h1Count = $('h1').length
  if (h1Count === 0) return { ok: false, reason: 'no_h1' }
  if (h1Count > 1)   return { ok: false, reason: 'multiple_h1' }

  // (c) At least one landmark element
  if ($('header, nav, main, footer').length < 1) {
    return { ok: false, reason: 'no_landmark' }
  }

  // (d) Size guard
  if (Buffer.byteLength(clean, 'utf8') >= MAX_BYTES) {
    return { ok: false, reason: 'too_large' }
  }

  // (e) Defense-in-depth: assert no forbidden remnants survived sanitize
  if (SCRIPT_RE.test(clean) || INLINE_HANDLER_RE.test(clean)) {
    return { ok: false, reason: 'forbidden_remnant' }
  }

  // -------------------------------------------------------------------------
  // Step 4 — QUALITY INVARIANTS (Plan Bölüm 14). Backstops that catch free-form /
  // AI deviations from the hard quality rules. CONSERVATIVE by design: each fails
  // ONLY on a CLEAR violation and NEVER on a valid library-composed page.
  // -------------------------------------------------------------------------

  // (f) MOBILE-MENU INTEGRITY (reason: 'mobile_menu_broken').
  // A hamburger carries data-yoai-nav-toggle="X" (the runtime contract). For the
  // menu to work the controlled panel must EXIST. We fail ONLY on a CLEAR break:
  //   - there is NO element at all with id="X"  → the hamburger toggles nothing, OR
  //   - the element id="X" IS a [data-yoai-mobile-nav] panel but it is EMPTY
  //     (no element/text children → an empty slide-out with no menu).
  // We deliberately do NOT fail when id="X" exists but is a NON-mobile-nav element
  // (the runtime's documented legacy class/hidden toggle fallback) — that is a
  // valid pattern, not a broken hamburger. A page with NO toggle at all is OK
  // (we never REQUIRE a mobile menu). The SABİT navbar pairs the toggle with a
  // populated <nav id="X" data-yoai-mobile-nav> panel, so it always passes.
  const toggles = $('[data-yoai-nav-toggle]')
  let mobileMenuBroken = false
  toggles.each((_i, el) => {
    if (mobileMenuBroken) return
    const targetId = String($(el).attr('data-yoai-nav-toggle') ?? '').trim()
    if (!targetId) return // empty toggle value → not a clear panel-pairing claim
    // Use an attribute selector (robust for ids with special chars) + escape the
    // double-quote / backslash that would break the selector string itself.
    const escId = targetId.replace(/["\\]/g, '\\$&')
    const target = $(`[id="${escId}"]`)
    if (target.length === 0) {
      // Toggle points at a non-existent id → broken hamburger.
      mobileMenuBroken = true
      return
    }
    // If the target IS a mobile-nav panel, it must be non-empty (real menu).
    const panel = target.filter('[data-yoai-mobile-nav]')
    if (panel.length > 0) {
      const inner = panel.first().html()
      if (!inner || inner.trim() === '') mobileMenuBroken = true
    }
  })
  if (mobileMenuBroken) {
    return { ok: false, reason: 'mobile_menu_broken' }
  }

  // (g) STALE FOOTER YEAR (reason: 'stale_footer_year').
  // ONLY the footer copyright year — never general body content (a legitimate
  // content year like a blog date must NOT trip this). Scan the FOOTER scope:
  // <footer> elements + any [data-yoai-block^="footer"] block. Inside that scope,
  // if a copyright pattern (© / &copy; / Copyright + a 4-digit year, possibly a
  // range) names a year EARLIER than the current calendar year AND no year in that
  // run reaches the current year → fail. A single current year, or a range ending
  // in the current year (e.g. "2024-<currentYear>"), PASSES. currentYear is read
  // at gate time so the gate ages with the calendar, never hardcoded.
  const currentYear = new Date().getFullYear()
  const footerScope = $('footer, [data-yoai-block^="footer"]')
  let staleFooterYear = false
  footerScope.each((_i, el) => {
    if (staleFooterYear) return
    // Inspect the footer's HTML so &copy; entities are visible to the regex.
    const footerHtml = String($(el).html() ?? '')
    const m = FOOTER_COPYRIGHT_RE.exec(footerHtml)
    if (!m) return
    const years = (m[1].match(YEAR_RE) || []).map((y) => parseInt(y, 10))
    if (years.length === 0) return
    const maxYear = Math.max(...years)
    // The copyright's NEWEST year is in the past → stale. (A range that reaches
    // the current year, or a future year, is fine.)
    if (maxYear < currentYear) staleFooterYear = true
  })
  if (staleFooterYear) {
    return { ok: false, reason: 'stale_footer_year' }
  }

  // (h) TRANSPARENT HEADER (reason: 'transparent_header').
  // The header/navbar root must NOT be EXPLICITLY transparent (logo + menu must
  // stay readable on scroll). CONSERVATIVE: we fail ONLY on a clear see-through
  // signal on the navbar ROOT element — bg-transparent OR a fully-transparent
  // fill (bg-…/0). We do NOT fail merely because a bg class is absent (that would
  // be too aggressive and false-positive). The root is the <header> element OR,
  // failing that, the top element carrying [data-yoai-block^="navbar"]. The SABİT
  // navbar root is bg-[var(--surface)] (opaque), so it passes.
  const navRoots = $('header, [data-yoai-block^="navbar"]')
  let transparentHeader = false
  navRoots.each((_i, el) => {
    if (transparentHeader) return
    const cls = String($(el).attr('class') ?? '')
    if (TRANSPARENT_BG_RE.test(cls)) transparentHeader = true
  })
  if (transparentHeader) {
    return { ok: false, reason: 'transparent_header' }
  }

  // -------------------------------------------------------------------------
  // All checks passed — return the SANITIZED html (not the raw input)
  // -------------------------------------------------------------------------
  return { ok: true, html: clean }
}
