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
    // 'data-*' glob preserves data-yoai-* and all other data- attributes
    'data-*',
    // Tabindex
    'tabindex',
    // 'hidden' — safe standard global BOOLEAN attribute: controls visibility only,
    // carries no script/URL/handler (no XSS surface). REQUIRED by the runtime
    // contract: the mobile nav menu (<nav id="mobile-nav" hidden>) starts hidden
    // and yoai-site-runtime.js toggles this attribute to open/close it. Without
    // it on the allowlist the sanitizer would strip 'hidden' → menu renders OPEN
    // by default on the live site (visible UX defect).
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
    // Without 'hidden' here the mobile nav <nav id="mobile-nav" hidden> would lose the
    // attribute → menu renders OPEN by default (runtime toggles the 'hidden' attribute).
    allowedEmptyAttributes: ['alt', 'hidden'],
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
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],

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

      // --- any tag with style attr — strip if dangerous ---
      '*'(tagName, attribs) {
        if (attribs['style']) {
          const styleVal = attribs['style']
          const isDangerous = DANGEROUS_STYLE_PATTERNS.some((re) => re.test(styleVal))
          if (isDangerous) {
            const { style: _removed, ...rest } = attribs
            return { tagName, attribs: rest }
          }
        }
        return { tagName, attribs }
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
