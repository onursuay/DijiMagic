/**
 * lib/website/codegen/untrusted.mjs
 *
 * Pure ESM helper — no DB, no Next.js deps.
 * Imported by buildCodegenContext.ts AND the .mjs verify script.
 *
 * SECURITY — quarantine approach:
 *   External text (scraped profiles, brand intelligence, reference-URL content)
 *   is attacker-influenceable (prompt injection). We wrap it in an XML-like
 *   envelope so the model can only treat it as DATA, not instructions.
 *
 *   Neutralisation: any occurrence of `</untrusted_source` or `<untrusted_source`
 *   inside `text` is rendered inert by replacing `<` with the Unicode FULLWIDTH
 *   LESS-THAN SIGN (U+FF1C, "＜"). This is byte-distinct from ASCII `<`, so the
 *   LLM parser cannot mistake it for a real XML tag while the content remains
 *   fully readable. The replacement is applied to ALL occurrences.
 *
 *   Label escaping: `"` → `&quot;`, `>` → `&gt;` so the name="" attribute
 *   cannot be broken by injected content in the label string.
 */

/**
 * Escape a label string so it is safe to embed in a name="…" attribute.
 * @param {string} label
 * @returns {string}
 */
export function escapeLabel(label) {
  return label.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Neutralise any XML-tag-like patterns in untrusted text so they cannot
 * escape the wrapping envelope.
 *
 * Strategy: replace the ASCII less-than sign `<` that starts either
 *   `<untrusted_source` or `</untrusted_source`
 * with the FULLWIDTH LESS-THAN SIGN (U+FF1C).
 *
 * We match case-insensitively to handle variant capitalisation.
 *
 * @param {string} text
 * @returns {string}
 */
export function neutraliseUntrustedTags(text) {
  // Replace `<untrusted_source` and `</untrusted_source` (opening slash optional)
  return text.replace(/<(\/?\s*untrusted_source)/gi, '＜$1')
}

/**
 * Wrap `text` from an untrusted external source so the model treats it
 * strictly as data, not as instructions.
 *
 * @param {string} label  A short human-readable source label (e.g. "brand_profile")
 * @param {string} text   The raw external text to quarantine
 * @returns {string}      A block of the form:
 *   <untrusted_source name="label">
 *   …neutralised text…
 *   </untrusted_source>
 */
export function wrapUntrusted(label, text) {
  const safeLabel = escapeLabel(String(label))
  const safeText = neutraliseUntrustedTags(String(text))
  return `<untrusted_source name="${safeLabel}">\n${safeText}\n</untrusted_source>`
}
