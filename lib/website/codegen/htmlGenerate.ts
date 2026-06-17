/* ──────────────────────────────────────────────────────────
   Web Site Yöneticisi — Stage 3: Single-Page HTML (Opus 4.8)

   The most important generation step: Opus 4.8 produces the free-form,
   visually striking single-page marketing <body> HTML, themed entirely
   through the validated DesignSystem via CSS var() tokens.

   Key decisions (DO NOT regress — same constraints as Stage 1):
   - Opus 4.8 STREAMING: client.messages.stream({...}).finalMessage().
     max_tokens 16000, thinking:{type:'adaptive'}, output_config:{effort:'high'}.
   - NEVER send temperature / top_p / top_k / budget_tokens — Opus 4.8 → HTTP 400.
   - Full COLOR FREEDOM: the YoAi dashboard's amber/yellow ban does NOT apply to
     generated customer sites. The palette comes from the DesignSystem; a honey
     brand may (and should) get amber/gold. (See DesignSystem JSDoc + types.ts.)
   - Output is BODY-ONLY inner HTML (no doctype/head/body, no fences, no prose).
   - Images are {{IMG:query}} placeholders the model invents; we resolve them to
     real stock URLs afterwards (mirrors lib/website/ai/generate.ts), falling back
     to a neutral allowlist-safe data:image when stock is unavailable.
   - Hard-fail (throw) when Anthropic is not ready / the call errors / output is
     empty — the Stage-4 pipeline (Task 13) catches and uses the deterministic
     fallback. We never return junk.

   The var-name contract (prompt list ↔ toDesignVars keys) lives in the shared
   htmlGenerateShared.mjs module — single source of truth, identical for the .ts
   call and the .mjs verify assertions. (Distinct basename from htmlGenerate.ts so
   the extensionless './htmlGenerate' import unambiguously resolves to the .ts.)
   ────────────────────────────────────────────────────────── */

import { getAnthropicClient, isAnthropicReady } from '@/lib/anthropic/client'
import { pickStockImage, isStockReady } from '@/lib/website/stock'
import type { CodegenContext, DesignSystem, RawBodyHtml } from './types'

// ---------------------------------------------------------------------------
// Import the shared .mjs core (same pattern as designSystem.ts ↔
// assembleDocument.ts). STATIC literal specifier so Turbopack/webpack can
// resolve it. Keeps toDesignVars / resolveImagePlaceholders / the prompt as
// ONE source of truth shared with scripts/verify-website-codegen.mjs.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import {
  toDesignVars as _toDesignVars,
  resolveImagePlaceholders as _resolveImagePlaceholders,
  buildHtmlSystemPrompt as _buildHtmlSystemPrompt,
  buildHtmlUserMessage as _buildHtmlUserMessage,
  buildRepairUserMessage as _buildRepairUserMessage,
  cleanGeneratedHtml as _cleanGeneratedHtml,
} from './htmlGenerateShared.mjs'

const coreToDesignVars = _toDesignVars as (ds: DesignSystem) => Record<string, string>
const coreResolveImagePlaceholders = _resolveImagePlaceholders as (
  html: string,
  resolver: (query: string) => Promise<string>,
) => Promise<string>
const coreBuildHtmlSystemPrompt = _buildHtmlSystemPrompt as (ctx?: CodegenContext) => string
const coreBuildHtmlUserMessage = _buildHtmlUserMessage as (
  ctx: CodegenContext,
  ds: DesignSystem,
) => string
const coreBuildRepairUserMessage = _buildRepairUserMessage as (
  ctx: CodegenContext,
  ds: DesignSystem,
  previousBody: string,
  reason: string,
) => string
const coreCleanGeneratedHtml = _cleanGeneratedHtml as (raw: string) => string

// ---------------------------------------------------------------------------
// Re-export the testable glue so app code can import from the .ts surface.
// (The real implementations live in htmlGenerateShared.mjs.)
// ---------------------------------------------------------------------------

/** DesignSystem → :root CSS custom-property map (Task 13/14 designVars). */
export async function toDesignVars(ds: DesignSystem): Promise<Record<string, string>> {
  return coreToDesignVars(ds)
}

/** Replace {{IMG:query}} placeholders via an injected resolver (DI, pure). */
export async function resolveImagePlaceholders(
  html: string,
  resolver: (query: string) => Promise<string>,
): Promise<string> {
  return coreResolveImagePlaceholders(html, resolver)
}

// ---------------------------------------------------------------------------
// Model constant — same env override + Opus 4.8 default as Stage 1.
// ---------------------------------------------------------------------------

const MODEL = process.env.ANTHROPIC_MODEL_WEBSITE_INITIAL ?? 'claude-opus-4-8'
const MAX_TOKENS = 16000

// ---------------------------------------------------------------------------
// Real stock resolver — mirrors lib/website/ai/generate.ts.
// Honors isStockReady(); returns '' when no provider / no result so the pure
// resolver substitutes the neutral fallback image.
// ---------------------------------------------------------------------------

function makeStockResolver(): (query: string) => Promise<string> {
  const stockReady = isStockReady()
  return async (query: string): Promise<string> => {
    const q = (query || '').trim()
    if (!q || !stockReady) return ''
    try {
      const img = await pickStockImage(q)
      return img?.url ?? ''
    } catch {
      return ''
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Stage-3: generate the single-page marketing site <body> inner HTML.
 *
 * @returns the body-only HTML string (no doctype/head/body, no fences).
 * @throws  if Anthropic is not configured, the streaming call fails, or the
 *          model returns empty output. The pipeline (Task 13) catches and
 *          falls back to the deterministic template.
 */
export async function generateHomePageHtml(
  ctx: CodegenContext,
  ds: DesignSystem,
): Promise<RawBodyHtml> {
  return streamBodyHtml(coreBuildHtmlSystemPrompt(ctx), coreBuildHtmlUserMessage(ctx, ds))
}

/**
 * Stage-3 SELF-REPAIR (Task 13): ONE targeted retry of the body HTML.
 *
 * Same constraints + same scaffolding as generateHomePageHtml:
 *   - identical Opus 4.8 streaming call (NO temperature/top_p/top_k/budget_tokens;
 *     thinking:{type:'adaptive'}; output_config:{effort:'high'}; finalMessage()).
 *   - reuses the SAME system prompt (var contract / data-yoai-* / {{IMG:}} rules).
 *   - reuses the SAME {{IMG:query}} resolution + cleanGeneratedHtml.
 * The user message is buildRepairUserMessage(): the first-pass message PLUS a
 * SHORT directive derived from the gate reason + the previous (rejected) body.
 *
 * @returns the repaired body-only HTML string (images already resolved).
 * @throws  if Anthropic is not configured, the call fails, or output is empty.
 *          The orchestrator (generateHtmlSite) catches and reports ok:false.
 */
export async function repairHomePageHtml(
  ctx: CodegenContext,
  ds: DesignSystem,
  previousBody: string,
  reason: string,
): Promise<RawBodyHtml> {
  const user = coreBuildRepairUserMessage(ctx, ds, previousBody, reason)
  return streamBodyHtml(coreBuildHtmlSystemPrompt(ctx), user)
}

/**
 * Shared Opus 4.8 streaming call — single setup used by BOTH the first pass and
 * the self-repair. Keeping ONE call shape guarantees the repair can never drift
 * from the proven constraints (no temperature/top_p/top_k/budget_tokens).
 */
async function streamBodyHtml(
  system: string,
  user: string,
): Promise<RawBodyHtml> {
  if (!isAnthropicReady()) {
    throw new Error('[htmlGenerate] Anthropic not configured (ANTHROPIC_API_KEY missing)')
  }

  let rawText = ''
  try {
    const client = getAnthropicClient()

    // CRITICAL: Do NOT add temperature, top_p, top_k, or budget_tokens.
    // Opus 4.8 returns HTTP 400 for any of those. Streaming keeps the
    // long generation under server time limits and yields finalMessage().
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinking: { type: 'adaptive' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output_config: { effort: 'high' } as any,
      system,
      messages: [{ role: 'user', content: user }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const msg = await stream.finalMessage()
    for (const block of msg.content) {
      if (block.type === 'text') rawText += block.text
    }
  } catch (e) {
    throw new Error(
      `[htmlGenerate] generation failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  const bodyHtml = coreCleanGeneratedHtml(rawText)
  if (!bodyHtml || bodyHtml.length < 40) {
    throw new Error('[htmlGenerate] model returned empty/too-short HTML')
  }

  // Resolve {{IMG:query}} → real stock URLs (or neutral fallback). Never leaves
  // a raw placeholder behind, never ships a broken/unsafe src.
  const resolved = await coreResolveImagePlaceholders(bodyHtml, makeStockResolver())
  return resolved
}
