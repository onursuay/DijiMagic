/**
 * lib/website/codegen/sanitizeHtml.ts
 *
 * Deny-by-default HTML sanitizer for AI-generated marketing site HTML.
 * This is the publish gate's safety core — be conservative, strip on doubt.
 *
 * Single source of truth for ALL options (allowlist + transformTags + exclusiveFilter)
 * lives in: lib/website/codegen/sanitizeAllowlist.mjs
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
  buildSanitizeOptions,
} from './sanitizeAllowlist.mjs'

// Cast imported values to their TS types (inferred as `any` from .mjs)
export const SAFE_TAGS: string[] = _SAFE_TAGS as string[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SAFE_ATTRS: Record<string, AllowedAttribute[]> =
  _SAFE_ATTRS as unknown as Record<string, AllowedAttribute[]>

// ---------------------------------------------------------------------------
// Build sanitize-html options via shared factory (single source of truth)
// ---------------------------------------------------------------------------

const sanitizeOptions: IOptions = buildSanitizeOptions() as IOptions

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
