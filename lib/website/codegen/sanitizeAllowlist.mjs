/**
 * sanitizeAllowlist.mjs — Shared sanitize-html options (single source of truth).
 *
 * Consumed by:
 *   - lib/website/codegen/sanitizeHtml.ts (TS import via allowlistOptions)
 *   - scripts/verify-website-codegen.mjs   (plain node import)
 *
 * Deny-by-default: anything NOT in SAFE_TAGS / SAFE_ATTRS is stripped.
 */

export const SAFE_TAGS = [
  // Document structure
  'html', 'head', 'body',
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
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'symbol', 'use', 'clipPath', 'mask',
  'linearGradient', 'radialGradient', 'stop', 'pattern', 'image',
  'title', 'desc',
  // Misc — NOTE: <style> intentionally EXCLUDED (CSS injection risk; use class/style attrs instead)
  'link', 'meta', 'noscript', 'template',
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
  ],
  a: ['href', 'target', 'rel', 'download', 'title'],
  img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes', 'title'],
  source: ['src', 'srcset', 'sizes', 'type', 'media'],
  video: ['src', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop', 'poster', 'preload'],
  audio: ['src', 'controls', 'autoplay', 'muted', 'loop', 'preload'],
  track: ['src', 'kind', 'srclang', 'label', 'default'],
  link: ['rel', 'href', 'type', 'media', 'as', 'crossorigin', 'integrity'],
  meta: ['name', 'content', 'charset', 'http-equiv', 'property'],
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
  use: ['href', 'x', 'y', 'width', 'height', 'transform', 'class', 'id'],
  clipPath: ['id', 'clipPathUnits'],
  mask: ['id', 'x', 'y', 'width', 'height', 'maskUnits'],
  text: ['x', 'y', 'dx', 'dy', 'text-anchor', 'dominant-baseline', 'font-size', 'fill', 'class', 'id', 'transform'],
  tspan: ['x', 'y', 'dx', 'dy', 'class', 'id'],
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
]

/**
 * Allowed URL schemes for href attributes.
 */
export const SAFE_HREF_SCHEMES = ['http', 'https', 'mailto', 'tel']

/**
 * Allowed src schemes for img (https or data:image/).
 */
export const SAFE_IMG_SRC_RE = /^(https?:\/\/|data:image\/)/i
