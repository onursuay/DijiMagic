/**
 * lib/website/codegen/sanitizeHtml.ts
 *
 * Deny-by-default HTML sanitizer for AI-generated marketing site HTML.
 * This is the publish gate's safety core — be conservative, strip on doubt.
 *
 * Single source of truth for the allowlist lives in:
 *   lib/website/codegen/sanitizeAllowlist.mjs
 * (imported as a plain ESM module so the verify script can also consume it
 *  without TS transpilation — no duplication.)
 */

import sanitizeHtml from 'sanitize-html'
import type { IOptions, AllowedAttribute } from 'sanitize-html'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; bundler (Next.js) resolves it fine
import {
  SAFE_TAGS as _SAFE_TAGS,
  SAFE_ATTRS as _SAFE_ATTRS,
  DANGEROUS_STYLE_PATTERNS,
  SAFE_HREF_SCHEMES,
  SAFE_IMG_SRC_RE,
} from './sanitizeAllowlist.mjs'

// Cast imported values to their TS types (inferred as `any` from .mjs)
export const SAFE_TAGS: string[] = _SAFE_TAGS as string[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SAFE_ATTRS: Record<string, AllowedAttribute[]> =
  _SAFE_ATTRS as unknown as Record<string, AllowedAttribute[]>

// ---------------------------------------------------------------------------
// Build sanitize-html options
// ---------------------------------------------------------------------------

const sanitizeOptions: IOptions = {
  allowedTags: SAFE_TAGS,
  allowedAttributes: SAFE_ATTRS,
  allowedSchemes: SAFE_HREF_SCHEMES,
  allowedSchemesByTag: {
    img: ['https', 'data'],
    source: ['https', 'data'],
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
    const hasEventHandler = Object.keys(frame.attribs).some((attr) =>
      attr.toLowerCase().startsWith('on'),
    )
    return hasEventHandler
  },
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sanitize AI-generated marketing site HTML.
 *
 * Input:  raw HTML string (typically full page or body fragment from AI)
 * Output: safe HTML string with dangerous tags/attrs stripped
 *
 * Exports SAFE_TAGS / SAFE_ATTRS for reuse in renderGate.
 */
export function sanitizeSiteHtml(bodyHtml: string): string {
  if (!bodyHtml || typeof bodyHtml !== 'string') return ''
  return sanitizeHtml(bodyHtml, sanitizeOptions)
}
