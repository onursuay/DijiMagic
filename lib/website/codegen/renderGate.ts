/**
 * lib/website/codegen/renderGate.ts
 *
 * Thin typed wrapper around renderGate.mjs.
 *
 * The real gate logic (single source of truth) lives in the .mjs file so that:
 *   - The verify script (scripts/verify-website-codegen.mjs) can import it
 *     directly with plain Node without any TS transpilation step.
 *   - App code imports THIS file and gets full TypeScript types.
 *
 * Pattern mirrors assembleDocument.ts ↔ assembleDocument.mjs.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import { gateSiteHtml as _gateSiteHtml } from './renderGate.mjs'

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export type GateResult =
  | { ok: true; html: string }
  | { ok: false; reason: string }

/**
 * Stable reason strings returned on failure.
 * Callers (self-repair logic) key on these — do NOT change them.
 */
export type GateFailReason =
  | 'parse_error'        // cheerio could not parse the sanitized output
  | 'no_h1'             // zero <h1> elements
  | 'multiple_h1'       // more than one <h1>
  | 'no_landmark'       // no header / nav / main / footer
  | 'too_large'         // body >= 220 KB
  | 'forbidden_remnant' // <script or on<word>= pattern survived sanitize (should never happen)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mandatory publish gate for AI-generated site body HTML.
 *
 * 1. Sanitizes the input (shared buildSanitizeOptions — single source of truth).
 * 2. Parses with cheerio.
 * 3. Validates structure + safety (h1 count, landmarks, size, remnants).
 * 4. On success returns { ok: true, html } with the SANITIZED html.
 * 5. On failure returns { ok: false, reason } with a stable reason key.
 *
 * A broken / empty / unsafe site NEVER goes live — the caller must
 * self-repair or fall back + refund credit on failure.
 */
export const gateSiteHtml: (bodyHtml: string) => GateResult =
  _gateSiteHtml as (bodyHtml: string) => GateResult
