/**
 * sanitizeAllowlist.mjs — Shared sanitize-html options (single source of truth).
 *
 * Consumed by:
 *   - lib/website/codegen/sanitizeHtml.ts (TS import via buildSanitizeOptions)
 *   - scripts/verify-website-codegen.mjs   (plain node import)
 *
 * Deny-by-default: anything NOT in SAFE_TAGS / SAFE_ATTRS is stripped.
 *
 * SECURITY NOTES:
 *   - <use>  REMOVED: external href loads attacker SVG (sprite-injection XSS)
 *   - <meta> REMOVED: http-equiv=refresh + javascript: = open redirect/exec
 *   - <link> REMOVED: external stylesheet = CSS injection / UI-redress
 *   - <html>/<head>/<body> REMOVED: sanitizer handles body-inner-HTML only
 *   - SVG <image href> guarded by SAFE_IMG_SRC_RE (same as HTML <img>)
 */

export const SAFE_TAGS = [
  // Layout / sectioning
  'section', 'div', 'header', 'footer', 'nav', 'main', 'article', 'aside',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Text
  'p', 'span', 'strong', 'em', 'b', 'i', 'u', 's', 'small', 'mark',
  'blockquote', 'q', 'cite', 'abbr', 'time', 'code', 'pre', 'kbd', 'samp',
  'sub', 'sup', 'del', 'ins', 'wbr', 'br', 'hr',
  // Links & media
  'a', 'img', 'picture', 'source', 'figure', 'figcaption', 'video', 'audio', 'track',
  // Lists
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // Tables (presentational only — no form-like tables)
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // Interactive (UI, no form submit)
  'button', 'label', 'details', 'summary',
  // CONTACT FORM (the ONLY form widening — minimal + tight): a working contact
  // form submitted DECLARATIVELY by the runtime (data-dijimagic-form), NEVER via a
  // native cross-origin POST. <form> has NO action/method/target (stripped). The
  // ONLY allowed inputs are type text/email/tel + a <textarea> (enforced in
  // transformTags below) — password/file/hidden/image/submit/etc. are forbidden.
  'form', 'input', 'textarea',
  // SVG (marketing icon / illustration safe subset)
  // NOTE: <use> intentionally EXCLUDED — external href loads attacker SVG (XSS)
  // NOTE: <title>/<desc> here are SVG child elements, NOT <head> tags
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'symbol', 'clipPath', 'mask',
  'linearGradient', 'radialGradient', 'stop', 'pattern', 'image',
  'title', 'desc',
  // NOTE: <style>, <link>, <meta>, <html>, <head>, <body>, <noscript>, <template>
  // intentionally EXCLUDED (head assembled by us; <style>/<noscript> are injection vectors)
]

/** @type {import('sanitize-html').Attributes} */
export const SAFE_ATTRS = {
  // Global attributes (all tags)
  '*': [
    'class', 'id',
    // style allowed but values are post-filtered (see transformTags)
    'style',
    // ARIA
    'role', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden',
    'aria-expanded', 'aria-controls', 'aria-current', 'aria-live', 'aria-atomic',
    'aria-selected', 'aria-checked', 'aria-disabled', 'aria-required', 'aria-invalid',
    'aria-haspopup', 'aria-orientation', 'aria-pressed', 'aria-valuemin',
    'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-level',
    // Data attributes — sanitize-html uses glob strings (not RegExp) for attribute matching
    // 'data-*' glob preserves data-dijimagic-* and all other data- attributes
    // (incl. the mobile-nav hooks data-dijimagic-mobile-nav + data-dijimagic-mobile-anim).
    'data-*',
    // Tabindex
    'tabindex',
    // 'hidden' — safe standard global BOOLEAN attribute: controls visibility only,
    // carries no script/URL/handler (no XSS surface). Kept on the allowlist for the
    // generic [data-dijimagic-toggle] hook (the runtime toggles the 'hidden' attribute on
    // its target). NOTE: the MOBILE nav no longer relies on 'hidden' — the runtime
    // hides/shows [data-dijimagic-mobile-nav] panels via INLINE styles (transform/opacity)
    // because a Tailwind display class (.flex/.block) overrides [hidden]{display:none}.
    'hidden',
  ],
  a: ['href', 'target', 'rel', 'download', 'title'],
  img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes', 'title'],
  source: ['src', 'srcset', 'sizes', 'type', 'media'],
  video: ['src', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop', 'poster', 'preload'],
  audio: ['src', 'controls', 'autoplay', 'muted', 'loop', 'preload'],
  track: ['src', 'kind', 'srclang', 'label', 'default'],
  // NOTE: <link> and <meta> intentionally omitted — head-only; injection vectors
  // SVG
  svg: ['xmlns', 'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width',
        'stroke-linecap', 'stroke-linejoin', 'class', 'id', 'aria-hidden', 'role',
        'preserveAspectRatio', 'overflow'],
  path: ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
         'opacity', 'fill-rule', 'clip-rule', 'class', 'id', 'transform'],
  g: ['fill', 'stroke', 'transform', 'opacity', 'class', 'id'],
  circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'opacity', 'class', 'id', 'transform'],
  ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'opacity', 'class', 'id', 'transform'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'opacity', 'class', 'id', 'transform'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'stroke-linecap', 'opacity', 'class', 'id', 'transform'],
  polyline: ['points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'class', 'id', 'transform'],
  polygon: ['points', 'fill', 'stroke', 'stroke-width', 'opacity', 'class', 'id', 'transform'],
  linearGradient: ['id', 'x1', 'y1', 'x2', 'y2', 'gradientUnits', 'gradientTransform'],
  radialGradient: ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits', 'gradientTransform'],
  stop: ['offset', 'stop-color', 'stop-opacity', 'class', 'style'],
  pattern: ['id', 'x', 'y', 'width', 'height', 'patternUnits', 'patternTransform'],
  defs: [],
  symbol: ['id', 'viewBox', 'width', 'height'],
  // NOTE: <use> intentionally omitted — external href is an XSS vector
  clipPath: ['id', 'clipPathUnits'],
  mask: ['id', 'x', 'y', 'width', 'height', 'maskUnits'],
  text: ['x', 'y', 'dx', 'dy', 'text-anchor', 'dominant-baseline', 'font-size', 'fill', 'class', 'id', 'transform'],
  tspan: ['x', 'y', 'dx', 'dy', 'class', 'id'],
  // SVG <image>: href guarded in buildSanitizeOptions transformTags (same rule as HTML <img>)
  image: ['href', 'x', 'y', 'width', 'height', 'preserveAspectRatio'],
  title: [],
  desc: [],
  // table
  th: ['scope', 'colspan', 'rowspan', 'class', 'style'],
  td: ['colspan', 'rowspan', 'class', 'style'],
  col: ['span', 'class', 'style'],
  colgroup: ['span', 'class'],
  // form elements kept passive (label OK, no action/method/input)
  button: ['type', 'disabled', 'name', 'value', 'form', 'class', 'id', 'style',
           'aria-label', 'aria-controls', 'aria-expanded', 'tabindex'],
  // CONTACT FORM tags — TIGHT allowlist (the ONLY form widening).
  // <form>: NO action/method/target/onsubmit/formaction/name — the runtime
  // submits declaratively via data-dijimagic-form (the safe marker) + the trusted
  // data-dijimagic-form-action that the SERVER injects AFTER sanitize.
  //
  // SECURITY (CRITICAL #3 — exfiltration defense-in-depth): `data-dijimagic-form-action`
  // is intentionally NOT on this allowlist. The submit URL is server-owned: the
  // serving layer injects it POST-sanitize (assembleDocument, serve mode only) as
  // a same-origin path. Any AI-authored `data-dijimagic-form-action` — single-quoted,
  // double-quoted OR unquoted — is therefore STRIPPED here by sanitize, so the AI
  // can never point the form at an attacker URL. Only `data-dijimagic-form` (the inert
  // marker) is allowed. (Previously this attr was allowlisted + cleaned by a
  // double-quote-only regex pre-sanitize, which a single-quoted/unquoted value
  // could slip past, leaving the AI's evil action as a surviving duplicate.)
  form: ['class', 'id', 'style', 'data-dijimagic-form',
         'aria-label', 'aria-labelledby', 'aria-describedby'],
  // <input>: type enforced to {text,email,tel} in transformTags below (any other
  // type — password/file/hidden/image/submit/button/checkbox/radio/number/url/
  // date/color/range — is coerced to "text"). NO formaction/form/on* (on* is
  // globally stripped). The honeypot is a type=text input hidden via class.
  input: ['type', 'name', 'placeholder', 'required', 'value', 'autocomplete',
          'maxlength', 'inputmode', 'class', 'id', 'style', 'tabindex',
          'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden',
          'aria-required', 'aria-invalid'],
  textarea: ['name', 'placeholder', 'required', 'rows', 'maxlength', 'class', 'id',
             'style', 'tabindex', 'aria-label', 'aria-labelledby',
             'aria-describedby', 'aria-required', 'aria-invalid'],
  label: ['for', 'class', 'id', 'style'],
  details: ['open', 'class', 'id'],
  summary: ['class', 'id'],
  // time
  time: ['datetime', 'class'],
}

/**
 * Dangerous patterns in style attribute values.
 * Strip the entire style attr if any pattern matches.
 */
export const DANGEROUS_STYLE_PATTERNS = [
  /javascript\s*:/i,
  /expression\s*\(/i,
  /behavior\s*:/i,
  /-moz-binding/i,
  /vbscript\s*:/i,
  /(?:^|;)\s*@import\b/i,
]

/**
 * Allowed URL schemes for href attributes.
 */
export const SAFE_HREF_SCHEMES = ['http', 'https', 'mailto', 'tel']

/**
 * CONTACT FORM — the ONLY <input> types permitted on a generated site.
 * A contact form needs name (text), email (email) and phone (tel). EVERYTHING
 * else is forbidden and coerced to "text" by transformTags.input:
 *   password   — credential collection (banned)
 *   file       — upload surface (banned)
 *   hidden     — silent payload smuggling (banned; honeypot is a visually-hidden type=text)
 *   image      — has a `src` → request/exec surface (banned)
 *   submit/button/reset — the submit control is a <button>, not an <input>
 *   checkbox/radio/number/url/date/color/range/search/month/week/time/datetime-local
 *              — out of scope for a contact form; not allowed
 * Coercing (not stripping the whole tag) keeps the field usable as a plain text
 * box rather than silently deleting it.
 */
export const SAFE_INPUT_TYPES = ['text', 'email', 'tel']

/**
 * Allowed src schemes for HTML <img> (https or data:image/).
 */
export const SAFE_IMG_SRC_RE = /^(https?:\/\/|data:image\/)/i

/**
 * Allowed href schemes for SVG <image>.
 * Stricter than SAFE_IMG_SRC_RE: only data:image/ is permitted.
 * External https is excluded — no legitimate need for external SVG images
 * in AI marketing pages, and tracking/CSRF risk outweighs the benefit.
 * Internal fragment refs (#id) are also allowed.
 */
export const SAFE_SVG_IMAGE_HREF_RE = /^(data:image\/|#)/i

/**
 * Build the sanitize-html options object (single source of truth).
 * Both sanitizeHtml.ts and the verify script consume this factory —
 * no duplicated transform/filter logic anywhere.
 *
 * @returns {import('sanitize-html').IOptions}
 */
export function buildSanitizeOptions() {
  return {
    allowedTags: SAFE_TAGS,
    allowedAttributes: SAFE_ATTRS,
    // 'hidden' is a valueless BOOLEAN attribute (parses as hidden=""). sanitize-html
    // lists 'hidden' in its default nonBooleanAttributes set, so an empty value is
    // dropped UNLESS the attr is in allowedEmptyAttributes. This option REPLACES the
    // library default (['alt']), so we re-include 'alt' to preserve alt="" handling.
    // 'hidden' is kept here for the generic [data-dijimagic-toggle] hook (runtime toggles
    // the 'hidden' attribute on its target). The MOBILE nav no longer uses 'hidden'
    // — it is hidden/shown via runtime inline styles (Tailwind display utilities
    // override [hidden]{display:none}, so attribute-hiding is unreliable there).
    // 'required' is a valueless BOOLEAN attribute (parses as required="") on the
    // contact-form <input>/<textarea> — included so the empty value is not dropped.
    // 'data-dijimagic-form' is the runtime form hook, also valueless.
    // 'data-dijimagic-gradient-anim' is the VALUELESS kinetic-gradient hook (the runtime
    // drifts the element's gradient background-position over time). VALUED hooks
    // (data-dijimagic-text-rotate / data-dijimagic-count-up / data-dijimagic-reveal …) already pass
    // via the data-* glob; only this valueless one needs listing here so the empty
    // value is not dropped. (Sanitizer core is otherwise UNCHANGED.)
    allowedEmptyAttributes: ['alt', 'hidden', 'required', 'data-dijimagic-form', 'data-dijimagic-gradient-anim'],
    allowedSchemes: SAFE_HREF_SCHEMES,
    allowedSchemesByTag: {
      img: ['https', 'data'],
      source: ['https', 'data'],
      // SVG <image href="data:image/..."> — data: permitted; further filtered by transformTags.image
      image: ['data'],
    },
    // Deny-by-default: don't silently pass unknown attrs
    allowedSchemesAppliedToAttributes: ['href', 'src', 'action', 'cite'],
    // Strip entire comments — comments can carry IE conditional exploits
    allowedClasses: {},  // allow all classes via the 'class' attr (handled above)
    // NOTE: 'textarea' is intentionally NOT in nonTextTags anymore — it is now an
    // ALLOWED contact-form tag, so its content (a default/placeholder-like value)
    // is kept as text, not discarded. 'style'/'script'/'option'/'noscript' stay
    // (they are not allowed tags; nonTextTags drops their text payload too).
    nonTextTags: ['style', 'script', 'option', 'noscript'],

    // Transform tags: post-process individual tags/attrs for fine-grained control
    transformTags: {
      // --- <a> — strip non-safe href schemes ---
      a(tagName, attribs) {
        const href = attribs['href'] ?? ''
        // Allow relative (#hash, /path), http/https, mailto, tel — strip everything else
        const isRelative = href.startsWith('#') || href.startsWith('/')
        const hasSafeScheme = SAFE_HREF_SCHEMES.some(
          (s) => href.toLowerCase().startsWith(s + ':'),
        )
        if (!isRelative && !hasSafeScheme && href !== '') {
          // Remove the href — keep the tag as plain text wrapper
          const { href: _removed, ...rest } = attribs
          return { tagName, attribs: rest }
        }
        // Force external links to be safe
        const finalAttribs = { ...attribs }
        if (href.startsWith('http') && !finalAttribs['target']) {
          finalAttribs['target'] = '_blank'
          finalAttribs['rel'] = 'noopener noreferrer'
        }
        return { tagName, attribs: finalAttribs }
      },

      // --- <img> — only https or data:image/ ---
      img(tagName, attribs) {
        const src = attribs['src'] ?? ''
        if (src && !SAFE_IMG_SRC_RE.test(src)) {
          const { src: _removed, ...rest } = attribs
          return { tagName, attribs: rest }
        }
        return { tagName, attribs }
      },

      // --- SVG <image> — only data:image/ or fragment refs (#id) allowed for href ---
      // External https is excluded: no legitimate AI-marketing-page use-case,
      // and it is a tracking / CSRF vector.
      image(tagName, attribs) {
        const href = attribs['href'] ?? ''
        if (href && !SAFE_SVG_IMAGE_HREF_RE.test(href)) {
          const { href: _removed, ...rest } = attribs
          return { tagName, attribs: rest }
        }
        return { tagName, attribs }
      },

      // --- CONTACT FORM <input> — ENFORCE type ∈ {text, email, tel} ---
      // This is the security core of the form widening. Any type NOT in
      // SAFE_INPUT_TYPES (password, file, hidden, image, submit, button, checkbox,
      // radio, number, url, date, color, range, …) is COERCED to "text" — never
      // allowed through. A missing/blank type defaults to "text" (HTML default).
      // `formaction`/`form` (already off the allowlist) and on* (global strip) get
      // no foothold. The honeypot stays a normal type=text input (hidden via class).
      input(tagName, attribs) {
        const rawType = String(attribs['type'] ?? '').trim().toLowerCase()
        const safeType = SAFE_INPUT_TYPES.includes(rawType) ? rawType : 'text'
        // Defense-in-depth: drop formaction/form even if a future allowlist edit
        // re-adds them — an <input> must never carry a submit-redirect surface.
        const { formaction: _fa, form: _f, ...rest } = attribs
        return { tagName, attribs: { ...rest, type: safeType } }
      },

      // --- any tag: strip the SERVER-OWNED form action + dangerous style ---
      '*'(tagName, attribs) {
        let attrs = attribs
        // CRITICAL #3 — the AI can NEVER author data-dijimagic-form-action (any quoting,
        // any tag). It is NOT a tag-allowlist attr, but the global `data-*` glob
        // would otherwise re-permit it on every element. Strip it unconditionally
        // here so sanitize removes any AI value; the trusted same-origin action is
        // injected by the SERVER AFTER sanitize (assembleDocument, serve mode).
        if ('data-dijimagic-form-action' in attrs) {
          const { 'data-dijimagic-form-action': _removedAction, ...rest } = attrs
          attrs = rest
        }
        if (attrs['style']) {
          const styleVal = attrs['style']
          const isDangerous = DANGEROUS_STYLE_PATTERNS.some((re) => re.test(styleVal))
          if (isDangerous) {
            const { style: _removed, ...rest } = attrs
            return { tagName, attribs: rest }
          }
        }
        return { tagName, attribs: attrs }
      },
    },

    // Disallow all on* event handlers (deny-by-default covers this via allowedAttributes,
    // but add explicit exclusion as defence-in-depth)
    exclusiveFilter(frame) {
      // Drop any attribute starting with 'on' that slipped through
      return Object.keys(frame.attribs).some((attr) =>
        attr.toLowerCase().startsWith('on'),
      )
    },
  }
}
