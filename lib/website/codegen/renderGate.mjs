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
