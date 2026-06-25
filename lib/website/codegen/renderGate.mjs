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
 *                       AI-authored data-dijimagic-form-action whose value is NOT a
 *                       same-origin path (exfiltration attempt — CRITICAL #3) in
 *                       the RAW input. ALSO backstopped post-sanitize: any
 *                       data-dijimagic-form-action that survives sanitize with a non-'/'
 *                       value (future allowlist regression) is rejected. The safe
 *                       contact form (text/email/tel + textarea + data-dijimagic-form,
 *                       no AI action) PASSES; the SERVER-injected same-origin
 *                       data-dijimagic-form-action="/…" PASSES. Defense-in-depth: the
 *                       sanitizer already coerces/strips these, but a page that
 *                       TRIED to collect credentials / smuggle a hidden payload /
 *                       POST or fetch cross-origin is rejected outright rather than
 *                       silently cleaned and published.
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

/** @type {RegExp} — defense-in-depth: <script remnant */
const SCRIPT_RE = /<script/i

/** @type {RegExp} — defense-in-depth: inline event handler attribute */
const INLINE_HANDLER_RE = /\son[a-z]+\s*=/i

/**
 * SUSPICIOUS FORM detection (runs on the RAW input, pre-sanitize) — per design §4.
 * A page that TRIED to collect credentials, smuggle a hidden payload, upload a
 * file, or POST cross-origin is REJECTED rather than silently cleaned. The safe
 * contact form (only text/email/tel inputs + <textarea> + data-dijimagic-form, no
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
 * @type {RegExp} — an AI-authored `data-dijimagic-form-action` value, captured so the
 * value can be checked with isSameOriginPath. The submit URL is SERVER-OWNED: the
 * sanitizer strips any AI `data-dijimagic-form-action` (any quoting), and the server
 * injects a trusted same-origin path POST-sanitize. So an AI body carrying a value
 * that is NOT same-origin (single/double-quoted OR unquoted: https://evil, //evil,
 * /\evil, mailto:, javascript:, …) is a form-exfiltration attempt → reject.
 * A same-origin '/…' value is tolerated (cannot exfiltrate; the server re-owns it).
 * Group 1: double-quoted value; 2: single-quoted; 3: unquoted (to first space/>).
 */
const FORM_ACTION_VALUE_RE =
  /\bdata-dijimagic-form-action\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+))/gi

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
  // The safe contact form (text/email/tel + textarea + data-dijimagic-form) never hits
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
  // Scan every data-dijimagic-form-action value (any quoting); reject if any is not a
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
  // `data-dijimagic-form-action` is OFF the sanitizer allowlist, so an AI-authored
  // value (any quoting) is already STRIPPED by sanitize; the trusted same-origin
  // action is injected by the SERVER only AFTER this gate runs. Therefore, in the
  // gated (sanitized, pre-injection) body, NO data-dijimagic-form-action should survive
  // at all. If one DOES survive with a value that is NOT a same-origin path (i.e.
  // does not start with '/'), it means a future allowlist regression let an
  // attacker URL through — reject outright rather than risk exfiltrating visitor
  // data to it. A same-origin '/path' is tolerated (harmless); the server still
  // re-owns the action post-gate.
  const survivedActions = $('[data-dijimagic-form-action]')
  let externalFormAction = false
  survivedActions.each((_i, el) => {
    const v = String($(el).attr('data-dijimagic-form-action') ?? '')
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
  // All checks passed — return the SANITIZED html (not the raw input)
  // -------------------------------------------------------------------------
  return { ok: true, html: clean }
}
