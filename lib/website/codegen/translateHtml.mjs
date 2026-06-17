/**
 * lib/website/codegen/translateHtml.mjs
 *
 * STRUCTURE-PRESERVING page translation core (Web Site Yöneticisi — çoklu dil).
 *
 * The default-locale site is generated ONCE (Opus). For each ADDITIONAL locale we
 * do NOT regenerate the whole site (cost + drift). Instead we take the gated
 * default-locale HTML and translate ONLY the human-readable text — text nodes plus
 * a short allowlist of translatable attributes (alt / title / aria-label /
 * placeholder). Everything else — tags, class names, data-yoai-* hooks, href / src,
 * inline style, url-ish values, the {{IMG}}-resolved image URLs — is preserved
 * byte-for-byte by construction (we only ever overwrite the collected text node /
 * attribute string in place; we never touch the DOM shape).
 *
 * The shared `.mjs` core is consumed by a thin `.ts` surface (translateHtml.ts) for
 * the real Sonnet call, and is imported DIRECTLY by scripts/verify-website-codegen.mjs
 * with an INJECTED fake translator — single source of truth, no TS build step.
 *
 * Contract:
 *   translatePageHtml(html, fromLocale, toLocale, translator)
 *     - translator: async (strings: string[]) => Promise<string[]>
 *       MUST return an array of the SAME length, SAME order. Caller (the .ts) wires
 *       the real Sonnet call; tests inject a fake.
 *     - Returns the translated HTML string (structure identical to input).
 *     - THROWS if: cheerio cannot parse, the translator returns a non-array, or the
 *       returned array length !== input length. The orchestrator catches the throw
 *       and FALLS BACK to the original (default-locale) html for that page+locale —
 *       a translation miss never fails the whole generation.
 *     - When there is nothing translatable (no text/attrs), the translator is NOT
 *       called and the original html is returned unchanged.
 */

import { load } from 'cheerio'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Attributes whose VALUE is human-readable copy and should be translated.
 * Deliberately small: NO data-* / class / id / href / src / style / role / type —
 * those are structural / url-ish and must survive untouched.
 * @type {ReadonlyArray<string>}
 */
export const TRANSLATABLE_ATTRS = ['alt', 'title', 'aria-label', 'placeholder']

/** Tags whose text content must NEVER be collected/translated (code, not copy). */
const SKIP_TEXT_PARENTS = new Set(['script', 'style', 'noscript'])

/** Locale code → English language name for the translation prompt. */
const LOCALE_NAMES = {
  tr: 'Turkish',
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ru: 'Russian',
  ar: 'Arabic',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  pl: 'Polish',
  sv: 'Swedish',
  el: 'Greek',
  az: 'Azerbaijani',
}

/**
 * Resolve a locale code to a human language name for the prompt.
 * Falls back to the bare code (lowercased) when unknown — the model still does the
 * right thing for ISO codes it recognises, and we never throw on an odd locale.
 * @param {string} code
 * @returns {string}
 */
export function localeToLanguageName(code) {
  const c = (code || '').trim().toLowerCase()
  return LOCALE_NAMES[c] || c || 'the target language'
}

// ---------------------------------------------------------------------------
// Extraction — collect translatable strings with a stable index
// ---------------------------------------------------------------------------

/**
 * Walk the parsed DOM and collect every translatable string, recording WHERE it
 * came from so we can reinsert by index. Order is a deterministic document walk
 * (text node, then this element's translatable attributes, then children) — stable
 * across extract/reinsert because we walk the SAME tree.
 *
 * @param {import('cheerio').CheerioAPI} $
 * @returns {{ strings: string[]; slots: Array<{ kind: 'text'; node: any } | { kind: 'attr'; el: any; name: string }> }}
 */
function collect($) {
  /** @type {string[]} */
  const strings = []
  /** @type {Array<{ kind: 'text'; node: any } | { kind: 'attr'; el: any; name: string }>} */
  const slots = []

  /** @param {any} node */
  function visit(node) {
    if (!node) return

    // Text node: collect if non-whitespace and its parent is not code.
    if (node.type === 'text') {
      const raw = typeof node.data === 'string' ? node.data : ''
      const parentName = node.parent && node.parent.type === 'tag' ? node.parent.name : ''
      if (raw.trim() && !SKIP_TEXT_PARENTS.has((parentName || '').toLowerCase())) {
        strings.push(raw)
        slots.push({ kind: 'text', node })
      }
      return
    }

    // Element: collect translatable attributes (non-empty), then recurse.
    if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
      const name = (node.name || '').toLowerCase()
      const isCode = SKIP_TEXT_PARENTS.has(name)
      const attribs = node.attribs || {}
      if (!isCode) {
        for (const attr of TRANSLATABLE_ATTRS) {
          const v = attribs[attr]
          if (typeof v === 'string' && v.trim()) {
            strings.push(v)
            slots.push({ kind: 'attr', el: node, name: attr })
          }
        }
      }
      const children = node.children || []
      for (const child of children) visit(child)
      return
    }

    // Fragment / root container: just recurse children.
    const children = node.children || []
    for (const child of children) visit(child)
  }

  // Walk every top-level node of the parsed fragment.
  const roots = $.root().toArray()
  for (const r of roots) visit(r)

  return { strings, slots }
}

/**
 * HTML-escape a translated value that is about to be written DIRECTLY into a
 * parsed node's `attribs` map (attribute reinsertion). This makes the attribute
 * reinsert safe BY CONSTRUCTION — a malicious/odd translation containing `<` / `>`
 * (e.g. `">` followed by `<script>…`) can no longer break out of the attribute and
 * inject live markup into the RAW translatePageHtml output (defense-in-depth: safe
 * even WITHOUT the downstream renderGate), AND a legitimate value with these chars
 * survives serialization instead of tripping the gate into an unnecessary fallback.
 *
 * IMPORTANT — why ONLY `<` and `>` are escaped here (no `&` / `"`):
 *   cheerio's serializer (`$.root().html()` with decodeEntities:false, cheerio 1.2.0)
 *   ALREADY quote-escapes `&` → `&amp;` and `"` → `&quot;` in attribute values on
 *   the way out. It does NOT escape `<` / `>` — that is the sole leak the review
 *   found. So we escape EXACTLY the two characters cheerio omits. Escaping `&`/`"`
 *   here too would be DOUBLE-escaped by cheerio (`&` → `&amp;amp;`), corrupting
 *   legitimate values like `alt="Tom & Jerry"` (which must serialize to
 *   `alt="Tom &amp; Jerry"`, not `&amp;amp;`). Text NODES are untouched: cheerio's
 *   serializer already HTML-escapes text-node `<` / `>` / `&` correctly, so the
 *   text path needs no change (verified).
 *
 * @param {string} value
 * @returns {string}
 */
function escapeAttrValueForReinsert(value) {
  return String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Reinsert translated strings back into their slots by index, preserving each
 * text node's surrounding whitespace (we trim() only for the model, but keep the
 * original leading/trailing whitespace so layout/spacing is untouched).
 *
 * @param {string[]} originals
 * @param {string[]} translated
 * @param {Array<{ kind: 'text'; node: any } | { kind: 'attr'; el: any; name: string }>} slots
 */
function reinsert(originals, translated, slots) {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const orig = originals[i]
    const next = typeof translated[i] === 'string' ? translated[i] : orig
    if (slot.kind === 'text') {
      // Preserve original leading/trailing whitespace around the translated core.
      // cheerio's serializer HTML-escapes text-node content on output, so this is
      // safe as-is (no manual escaping needed here).
      const leadMatch = orig.match(/^\s*/)
      const trailMatch = orig.match(/\s*$/)
      const lead = leadMatch ? leadMatch[0] : ''
      const trail = trailMatch ? trailMatch[0] : ''
      slot.node.data = lead + next.trim() + trail
    } else {
      // Attribute reinsert: HTML-escape so a translated value can NEVER break out of
      // the attribute (cheerio writes `.attribs` without escaping `<` / `>`).
      slot.el.attribs[slot.name] = escapeAttrValueForReinsert(next)
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Structure-preserving translation of a page's body HTML.
 *
 * @param {string} html        the default-locale body HTML (already gated)
 * @param {string} fromLocale  source locale code (e.g. 'tr')
 * @param {string} toLocale    target locale code (e.g. 'en')
 * @param {(strings: string[]) => Promise<string[]>} translator
 *        injected async translator (the real one calls Sonnet; tests inject a fake)
 * @returns {Promise<string>}  translated HTML (same structure)
 * @throws  if cheerio cannot parse, or the translator returns a wrong-length array
 */
export async function translatePageHtml(html, fromLocale, toLocale, translator) {
  if (!html || typeof html !== 'string') return ''

  // Parse the body fragment. decodeEntities:false keeps already-resolved entities
  // intact; we render back the same fragment shape (no <html>/<body> wrapper added).
  let $
  try {
    $ = load(html, { decodeEntities: false }, false)
  } catch (e) {
    throw new Error(`[translateHtml] parse failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  const { strings, slots } = collect($)

  // Nothing translatable → return the original unchanged (no model call, no cost).
  if (strings.length === 0) return html

  if (typeof translator !== 'function') {
    throw new Error('[translateHtml] translator is not a function')
  }

  const translated = await translator(strings)
  if (!Array.isArray(translated) || translated.length !== strings.length) {
    throw new Error(
      `[translateHtml] translator returned ${
        Array.isArray(translated) ? `${translated.length} items` : 'a non-array'
      }, expected ${strings.length} — caller must fall back to original`,
    )
  }

  reinsert(strings, translated, slots)

  return $.root().html() ?? html
}

/**
 * Translate a small batch of plain strings (used for SEO title/description and any
 * other short copy). Same length/array contract + same throw-on-mismatch as
 * translatePageHtml so the caller can fall back identically.
 *
 * @param {string[]} strings
 * @param {(strings: string[]) => Promise<string[]>} translator
 * @returns {Promise<string[]>}
 * @throws  if the translator returns a wrong-length array
 */
export async function translateStrings(strings, translator) {
  const input = (strings || []).map((s) => (typeof s === 'string' ? s : ''))
  if (input.length === 0) return []
  if (typeof translator !== 'function') {
    throw new Error('[translateHtml] translator is not a function')
  }
  const out = await translator(input)
  if (!Array.isArray(out) || out.length !== input.length) {
    throw new Error(
      `[translateHtml] translateStrings returned ${
        Array.isArray(out) ? `${out.length} items` : 'a non-array'
      }, expected ${input.length}`,
    )
  }
  return out.map((s, i) => (typeof s === 'string' && s.trim() ? s : input[i]))
}

/**
 * Build the translation instruction (system + user) for the real Sonnet call.
 * Kept here so the prompt is part of the shared core (single source of truth).
 *
 * @param {string} fromLocale
 * @param {string} toLocale
 * @param {string[]} strings
 * @returns {{ system: string; user: string }}
 */
export function buildTranslationPrompt(fromLocale, toLocale, strings) {
  const fromName = localeToLanguageName(fromLocale)
  const toName = localeToLanguageName(toLocale)
  const system =
    `You are a professional website localizer. You translate UI/marketing copy from ${fromName} to ${toName}.\n` +
    `You will receive a JSON array of strings. Translate EACH string into natural, fluent ${toName}.\n` +
    `Rules (STRICT):\n` +
    `- Return ONLY a JSON array of strings — no markdown, no prose, no object wrapper.\n` +
    `- The returned array MUST have EXACTLY the same length and the same order as the input.\n` +
    `- Do NOT add, remove, merge, split or reorder items.\n` +
    `- Keep brand names, proper nouns, product names, URLs, emails and phone numbers UNCHANGED.\n` +
    `- Preserve numbers, currency and symbols; translate only the words.\n` +
    `- If a string is already in ${toName} or is not translatable (e.g. a symbol), return it unchanged.`
  const user = JSON.stringify(strings)
  return { system, user }
}

/**
 * Tolerant-parse the model's reply into a string array. Accepts a bare JSON array
 * or an array embedded in surrounding text. Returns null if no array is found
 * (caller treats null as a translation miss and falls back).
 *
 * @param {string | null} text
 * @returns {string[] | null}
 */
export function parseTranslationArray(text) {
  if (!text || typeof text !== 'string') return null
  const tryParse = (s) => {
    try {
      const v = JSON.parse(s)
      if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : String(x ?? '')))
      return null
    } catch {
      return null
    }
  }
  const direct = tryParse(text.trim())
  if (direct) return direct
  const fb = text.indexOf('[')
  const lb = text.lastIndexOf(']')
  if (fb >= 0 && lb > fb) return tryParse(text.slice(fb, lb + 1))
  return null
}
