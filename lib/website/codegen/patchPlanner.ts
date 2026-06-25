import 'server-only'
/**
 * lib/website/codegen/patchPlanner.ts
 *
 * Chat-edit PATCH PLANNER + per-block regeneration — the Sonnet-backed `.ts`
 * surface over the pure cores (patchPlannerShared.mjs + blockMap.mjs +
 * htmlGenerateShared.mjs block builders).
 *
 * Two responsibilities, both Sonnet (claude-sonnet-4-6 — cheap, like translateHtml.ts):
 *   1. planPatchOps(summaries, instruction, knownIds) → validated atomic ops
 *      (Sonnet turns the command into ops; validateOps is the deterministic
 *       security gate — NO unvalidated op leaves this function).
 *   2. regenerateBlock(ctx, ds, kind, block, instruction) → new block HTML for an
 *      `edit`/`insert` op ({{IMG:}} already resolved, fences stripped).
 *
 * SDK shape mirrors translateHtml.ts / brandSynthesis.ts: getAnthropicClient()
 * .messages.create with NO temperature / top_p / top_k / budget_tokens.
 * Best-effort — a throw here is caught by applyBlockPatch which falls back to a
 * full regenerate (edit never dead-ends).
 */

import { getAnthropicClient, isAnthropicReady } from '@/lib/anthropic/client'
import { pickStockImage, isStockReady } from '@/lib/website/stock'
import type { CodegenContext, DesignSystem } from './types'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import {
  buildPlannerSystemPrompt as _buildPlannerSystemPrompt,
  buildPlannerUserMessage as _buildPlannerUserMessage,
  parsePlannerOps as _parsePlannerOps,
  validateOps as _validateOps,
} from './patchPlannerShared.mjs'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import {
  buildBlockSystemPrompt as _buildBlockSystemPrompt,
  buildBlockEditUserMessage as _buildBlockEditUserMessage,
  buildBlockInsertUserMessage as _buildBlockInsertUserMessage,
  cleanGeneratedBlock as _cleanGeneratedBlock,
  resolveImagePlaceholders as _resolveImagePlaceholders,
} from './htmlGenerateShared.mjs'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type BlockSummary = { id: string; role: string; snippet: string }
/**
 * A block extracted from the page body. `start`/`end` are the byte offsets of the
 * block's outerHTML in the ORIGINAL body string (htmlparser2 indices) — used by
 * mergeBlocks to splice the original body in place. Optional so the per-block
 * regeneration path (which fabricates a bare { id, role, html }) still type-checks.
 */
export type Block = { id: string; role: string; html: string; start?: number; end?: number }
export type PatchOp = { op: 'edit' | 'insert' | 'delete' | 'move'; targetId: string; after?: string }
export type ValidatedOps = { ops: PatchOp[]; fallback: boolean }

const coreBuildPlannerSystemPrompt = _buildPlannerSystemPrompt as () => string
const coreBuildPlannerUserMessage = _buildPlannerUserMessage as (
  summaries: BlockSummary[],
  instruction: string,
) => string
const coreParsePlannerOps = _parsePlannerOps as (text: string | null) => Array<Record<string, unknown>>
const coreValidateOps = _validateOps as (
  rawOps: Array<Record<string, unknown>>,
  knownIds: Iterable<string>,
) => ValidatedOps

const coreBuildBlockSystemPrompt = _buildBlockSystemPrompt as (ctx?: CodegenContext) => string
const coreBuildBlockEditUserMessage = _buildBlockEditUserMessage as (
  ctx: CodegenContext,
  ds: DesignSystem,
  block: Block,
  instruction: string,
) => string
const coreBuildBlockInsertUserMessage = _buildBlockInsertUserMessage as (
  ctx: CodegenContext,
  ds: DesignSystem,
  block: { id: string; role: string },
  instruction: string,
) => string
const coreCleanGeneratedBlock = _cleanGeneratedBlock as (raw: string) => string
const coreResolveImagePlaceholders = _resolveImagePlaceholders as (
  html: string,
  resolver: (query: string) => Promise<string>,
) => Promise<string>

// ---------------------------------------------------------------------------
// Model constants — Sonnet (revision/planner), same env override as translateHtml.
// ---------------------------------------------------------------------------

const MODEL = process.env.ANTHROPIC_MODEL_WEBSITE_REVISION ?? 'claude-sonnet-4-6'
const PLANNER_MAX_TOKENS = 1500
const BLOCK_MAX_TOKENS = 8000

// ---------------------------------------------------------------------------
// Stock resolver — mirrors htmlGenerate.ts makeStockResolver (single behavior).
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
// 1. Planner — Sonnet command → ops, then DETERMINISTIC validation (security gate).
// ---------------------------------------------------------------------------

/**
 * Turn the user's natural-language change request into a SMALL list of VALIDATED
 * atomic block ops. The Sonnet call proposes ops; validateOps(knownIds) is the
 * security boundary — every targetId/after is checked against the real block id
 * set, op kinds are allowlisted, the list is capped, invalid ops are dropped, and
 * insert ids are minted fresh. NO unvalidated op leaves this function.
 *
 * @returns { ops, fallback } — `fallback:true` means "no valid op → caller should
 *          full-regenerate". Also returns fallback:true if Anthropic is not ready
 *          or the call throws (best-effort; caller falls back gracefully).
 */
export async function planPatchOps(
  summaries: BlockSummary[],
  instruction: string,
  knownIds: Iterable<string>,
): Promise<ValidatedOps> {
  if (!isAnthropicReady()) return { ops: [], fallback: true }

  let text: string | null = null
  try {
    const client = getAnthropicClient()
    // CRITICAL: no temperature / top_p / top_k / budget_tokens (mirror translateHtml.ts).
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: PLANNER_MAX_TOKENS,
      system: coreBuildPlannerSystemPrompt(),
      messages: [{ role: 'user', content: coreBuildPlannerUserMessage(summaries, instruction) }],
    })
    for (const block of res.content) {
      if (block.type === 'text') text = (text ?? '') + block.text
    }
  } catch (e) {
    console.warn('[patchPlanner] planner call failed:', e instanceof Error ? e.message : e)
    return { ops: [], fallback: true }
  }

  const raw = coreParsePlannerOps(text)
  // Deterministic validation is the security gate — always runs on the raw output.
  return coreValidateOps(raw, knownIds)
}

// ---------------------------------------------------------------------------
// 2. Per-block regeneration — Sonnet rewrites/creates ONE block.
// ---------------------------------------------------------------------------

/**
 * Regenerate ONE block's HTML for an `edit` or `insert` op. Reuses the block-level
 * contract prompt (var tokens, data-dijimagic-* hooks, no script/forms) and resolves
 * {{IMG:}} placeholders just like the full-page path.
 *
 * @param ctx          Stage-0 context (brand/locale/untrusted context)
 * @param ds           Stage-1 DesignSystem (for mood awareness in the prompt)
 * @param kind         'edit' (rewrite block.html) | 'insert' (create new block.id/role)
 * @param block        for edit: the current block; for insert: the fresh { id, role }
 * @param instruction  the user's change request
 * @returns the new block HTML (one top-level element, images resolved, fences stripped)
 * @throws  if Anthropic is not ready, the call fails, or output is empty — the
 *          orchestrator catches and falls back to a full regenerate.
 */
export async function regenerateBlock(
  ctx: CodegenContext,
  ds: DesignSystem,
  kind: 'edit' | 'insert',
  block: Block,
  instruction: string,
): Promise<string> {
  if (!isAnthropicReady()) {
    throw new Error('[patchPlanner] Anthropic not configured (ANTHROPIC_API_KEY missing)')
  }

  const user =
    kind === 'insert'
      ? coreBuildBlockInsertUserMessage(ctx, ds, { id: block.id, role: block.role }, instruction)
      : coreBuildBlockEditUserMessage(ctx, ds, block, instruction)

  let rawText = ''
  try {
    const client = getAnthropicClient()
    // CRITICAL: no temperature / top_p / top_k / budget_tokens.
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: BLOCK_MAX_TOKENS,
      system: coreBuildBlockSystemPrompt(ctx),
      messages: [{ role: 'user', content: user }],
    })
    for (const b of res.content) {
      if (b.type === 'text') rawText += b.text
    }
  } catch (e) {
    throw new Error(
      `[patchPlanner] block regeneration failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  const blockHtml = coreCleanGeneratedBlock(rawText)
  if (!blockHtml || blockHtml.length < 10) {
    throw new Error('[patchPlanner] model returned empty/too-short block HTML')
  }

  // Resolve {{IMG:query}} → real stock URLs (or neutral fallback) — same as full page.
  return coreResolveImagePlaceholders(blockHtml, makeStockResolver())
}
