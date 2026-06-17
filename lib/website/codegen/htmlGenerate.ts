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
   htmlGenerate.mjs module — single source of truth, identical for the .ts call
   and the .mjs verify assertions.
   ────────────────────────────────────────────────────────── */

import path from 'path'
import { fileURLToPath } from 'url'

import { getAnthropicClient, isAnthropicReady } from '@/lib/anthropic/client'
import { pickStockImage, isStockReady } from '@/lib/website/stock'
import type { CodegenContext, DesignSystem, RawBodyHtml } from './types'

// ---------------------------------------------------------------------------
// Lazy-load the shared .mjs core (same pattern as designSystem.ts).
// Keeps toDesignVars / resolveImagePlaceholders / the prompt as ONE source of
// truth shared with scripts/verify-website-codegen.mjs.
// ---------------------------------------------------------------------------

interface HtmlGenCore {
  toDesignVars: (ds: DesignSystem) => Record<string, string>
  resolveImagePlaceholders: (
    html: string,
    resolver: (query: string) => Promise<string>,
  ) => Promise<string>
  buildHtmlSystemPrompt: () => string
  buildHtmlUserMessage: (ctx: CodegenContext, ds: DesignSystem) => string
  cleanGeneratedHtml: (raw: string) => string
  FALLBACK_IMAGE: string
}

let _core: HtmlGenCore | null = null

async function loadCore(): Promise<HtmlGenCore> {
  if (_core !== null) return _core
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const corePath = path.join(__dirname, 'htmlGenerate.mjs')
  const mod = await import(corePath)
  _core = {
    toDesignVars: mod.toDesignVars as HtmlGenCore['toDesignVars'],
    resolveImagePlaceholders: mod.resolveImagePlaceholders as HtmlGenCore['resolveImagePlaceholders'],
    buildHtmlSystemPrompt: mod.buildHtmlSystemPrompt as HtmlGenCore['buildHtmlSystemPrompt'],
    buildHtmlUserMessage: mod.buildHtmlUserMessage as HtmlGenCore['buildHtmlUserMessage'],
    cleanGeneratedHtml: mod.cleanGeneratedHtml as HtmlGenCore['cleanGeneratedHtml'],
    FALLBACK_IMAGE: mod.FALLBACK_IMAGE as string,
  }
  return _core
}

// ---------------------------------------------------------------------------
// Re-export the testable glue so app code can import from the .ts surface.
// (The real implementations live in htmlGenerate.mjs.)
// ---------------------------------------------------------------------------

/** DesignSystem → :root CSS custom-property map (Task 13/14 designVars). */
export async function toDesignVars(ds: DesignSystem): Promise<Record<string, string>> {
  const core = await loadCore()
  return core.toDesignVars(ds)
}

/** Replace {{IMG:query}} placeholders via an injected resolver (DI, pure). */
export async function resolveImagePlaceholders(
  html: string,
  resolver: (query: string) => Promise<string>,
): Promise<string> {
  const core = await loadCore()
  return core.resolveImagePlaceholders(html, resolver)
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
  if (!isAnthropicReady()) {
    throw new Error('[htmlGenerate] Anthropic not configured (ANTHROPIC_API_KEY missing)')
  }

  const core = await loadCore()
  const system = core.buildHtmlSystemPrompt()
  const user = core.buildHtmlUserMessage(ctx, ds)

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

  const bodyHtml = core.cleanGeneratedHtml(rawText)
  if (!bodyHtml || bodyHtml.length < 40) {
    throw new Error('[htmlGenerate] model returned empty/too-short HTML')
  }

  // Resolve {{IMG:query}} → real stock URLs (or neutral fallback). Never leaves
  // a raw placeholder behind, never ships a broken/unsafe src.
  const resolved = await core.resolveImagePlaceholders(bodyHtml, makeStockResolver())
  return resolved
}
