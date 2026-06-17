import 'server-only'
/**
 * lib/website/codegen/applyBlockPatch.ts
 *
 * Orchestrator for BLOCK-BASED chat-edit (Faz 3 — Lovable-style surgical revise).
 *
 * Flow (design doc §6):
 *   1. Load the target page (slug + locale) from the site's persisted pages.
 *   2. extractBlocks(body) — byte-exact top-level data-yoai-id sections.
 *   3. planPatchOps(...) — Sonnet → VALIDATED atomic ops (security-gated).
 *      No valid op → { ok:false, reason:'no_ops' } (caller falls back to full regen).
 *   4. regenerateBlock(...) for each edit/insert — Sonnet rewrites ONE block.
 *   5. mergeBlocks(...) — apply ops; UNTOUCHED blocks stay BYTE-IDENTICAL.
 *   6. sanitize + renderGate the WHOLE merged body. Gate fail → ONE self-repair
 *      (re-run the changed blocks once); still failing → { ok:false }.
 *   7. Return the updated WebsitePageInput (same slug/locale/role/orderIndex, new
 *      html, format:'html').
 *
 * NEVER throws — every failure path returns { ok:false, reason } so the route can
 * fall back to the existing full regenerate-with-instruction (edit never dead-ends).
 *
 * Reuses the SAME var/data-yoai-* contract (block prompts in htmlGenerateShared)
 * and the SAME publish gate (renderGate) as the full-page path. lib/meta/* and
 * lib/google/* are untouched.
 */

import type { PageRole, Website, WebsitePage, WebsitePageInput } from '@/lib/website/types'
import { getPages } from '@/lib/website/store'
import { buildCodegenContext } from './buildCodegenContext'
import { generateDesignSystem } from './designSystem'
import { gateSiteHtml } from './renderGate'
import { planPatchOps, regenerateBlock, type Block, type PatchOp } from './patchPlanner'
import type { CodegenContext, DesignSystem } from './types'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import {
  extractBlocks as _extractBlocks,
  summarizeBlocks as _summarizeBlocks,
  mergeBlocks as _mergeBlocks,
} from './blockMap.mjs'

const coreExtractBlocks = _extractBlocks as (bodyHtml: string) => Block[]
const coreSummarizeBlocks = _summarizeBlocks as (
  blocks: Block[],
) => { id: string; role: string; snippet: string }[]
const coreMergeBlocks = _mergeBlocks as (
  originalBody: string,
  blocks: Block[],
  ops: PatchOp[],
  newHtmlById: Record<string, string>,
) => string

export interface ApplyBlockPatchInput {
  targetSlug: string
  targetLocale: string
  instruction: string
}

export type ApplyBlockPatchResult =
  | { ok: true; page: WebsitePageInput }
  | { ok: false; reason: string }

/**
 * Apply a targeted block-patch to ONE page of the site.
 *
 * @param userId   owner of the site (context scoping + page ownership)
 * @param website  the site row
 * @param input    { targetSlug, targetLocale, instruction }
 * @returns { ok:true, page } on a gated success; { ok:false, reason } otherwise
 *          (the route falls back to a full regenerate). Never throws.
 */
export async function applyBlockPatch(
  userId: string,
  website: Website,
  input: ApplyBlockPatchInput,
): Promise<ApplyBlockPatchResult> {
  const instruction = (input.instruction || '').trim()
  if (!instruction) return { ok: false, reason: 'no_instruction' }

  try {
    // 1. Load the target page (slug + locale). Must be an html-format page.
    const pages = await getPages(userId, website.id)
    const target = pickTargetPage(pages, input.targetSlug, input.targetLocale)
    if (!target) return { ok: false, reason: 'page_not_found' }
    const sourceBody = typeof target.html === 'string' ? target.html : ''
    if (target.format !== 'html' || !sourceBody) return { ok: false, reason: 'not_html_page' }

    // 2. Byte-exact top-level blocks.
    const blocks = coreExtractBlocks(sourceBody)
    if (blocks.length === 0) return { ok: false, reason: 'no_blocks' }
    const knownIds = blocks.map((b) => b.id)

    // 3. Plan ops (Sonnet → validated). No valid op → fall back to full regen.
    const summaries = coreSummarizeBlocks(blocks)
    const { ops, fallback } = await planPatchOps(summaries, instruction, knownIds)
    if (fallback || ops.length === 0) return { ok: false, reason: 'no_ops' }

    // Build the codegen context (brand + untrusted blocks) + design system ONCE so
    // every regenerated block stays on-brand and on-token (reused for self-repair).
    const ctx = await buildCodegenContext(userId, website, { instructions: instruction, revisionMode: 'edit' })
    const ds = await generateDesignSystem(ctx)

    // 4 + 5 + 6. Regenerate changed blocks → merge → gate, with ONE self-repair.
    const first = await buildAndGate(ctx, ds, sourceBody, blocks, ops, instruction)
    if (first.ok) return finalize(target, first.html)

    // ONE self-repair: re-regenerate the changed blocks once + re-merge + re-gate.
    // (A second model pass can fix a transient bad block; we never loop further.)
    const second = await buildAndGate(ctx, ds, sourceBody, blocks, ops, instruction)
    if (second.ok) return finalize(target, second.html)

    return { ok: false, reason: second.reason || first.reason || 'gate_failed' }
  } catch (e) {
    console.warn('[applyBlockPatch] soft-fail:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'patch_failed' }
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Regenerate every edit/insert block, merge with the originals (untouched blocks
 * byte-identical), sanitize + renderGate the whole body.
 *
 * Returns { ok:true, html } with the GATED (sanitized) html, or { ok:false, reason }.
 * If ANY block regeneration throws, returns ok:false (caller decides next step).
 */
async function buildAndGate(
  ctx: CodegenContext,
  ds: DesignSystem,
  sourceBody: string,
  blocks: Block[],
  ops: PatchOp[],
  instruction: string,
): Promise<{ ok: true; html: string } | { ok: false; reason: string }> {
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const newHtmlById: Record<string, string> = {}

  for (const op of ops) {
    if (op.op === 'edit') {
      const cur = byId.get(op.targetId)
      if (!cur) continue // validateOps guarantees existence; defensive
      try {
        newHtmlById[op.targetId] = await regenerateBlock(ctx, ds, 'edit', cur, instruction)
      } catch (e) {
        console.warn('[applyBlockPatch] edit regen failed:', e instanceof Error ? e.message : e)
        return { ok: false, reason: 'block_regen_failed' }
      }
    } else if (op.op === 'insert') {
      try {
        // The fresh id is carried by op.targetId; role hint is left to the model.
        newHtmlById[op.targetId] = await regenerateBlock(
          ctx,
          ds,
          'insert',
          { id: op.targetId, role: '', html: '' },
          instruction,
        )
      } catch (e) {
        console.warn('[applyBlockPatch] insert regen failed:', e instanceof Error ? e.message : e)
        return { ok: false, reason: 'block_regen_failed' }
      }
    }
    // delete / move need no new HTML.
  }

  // Splice the ops onto the ORIGINAL body — the <main> wrapper, inter-block
  // whitespace and any untouched block stay BYTE-IDENTICAL (never re-assembled).
  const merged = coreMergeBlocks(sourceBody, blocks, ops, newHtmlById)
  if (!merged) return { ok: false, reason: 'empty_merge' }

  // Structural invariant (defense-in-depth): a gutted page can NEVER persist even
  // if extraction/merge has an edge case. Fail → ok:false → route full-regenerates.
  const inv = assertStructuralInvariants(sourceBody, merged, blocks, ops)
  if (!inv.ok) return { ok: false, reason: inv.reason }

  // Same publish gate as the full-page path (sanitize → parse → structure → size).
  const gate = gateSiteHtml(merged)
  if (gate.ok === false) return { ok: false, reason: gate.reason }
  return { ok: true, html: gate.html }
}

/**
 * STRUCTURAL INVARIANT — defense-in-depth guard run after merge, before persist.
 * Guarantees the merge did not silently gut the page (the H Critical data-loss bug).
 *
 * Asserts, against the ORIGINAL source body:
 *   1. NO SILENT DISAPPEARANCE — every data-yoai-id present in the source is still
 *      present in the merged body UNLESS an explicit `delete` op targeted that id.
 *   2. WRAPPER PRESERVED — every top-level structural wrapper the source had
 *      (<main>, <header>, <footer>) is still opened in the merged body. The H bug
 *      dropped the <main> wrapper + all its sections; this catches exactly that.
 *   3. NO IMPLAUSIBLE SHRINK — when there is NO delete op, the merged body must not
 *      collapse to a small fraction of the source (catches a wholesale gutting that
 *      somehow kept the wrappers/ids text but lost everything else).
 *
 * @returns { ok:true } or { ok:false, reason }
 */
function assertStructuralInvariants(
  sourceBody: string,
  mergedBody: string,
  blocks: Block[],
  ops: PatchOp[],
): { ok: true } | { ok: false; reason: string } {
  const deletedIds = new Set(
    ops.filter((o) => o.op === 'delete').map((o) => o.targetId),
  )
  const hasDelete = deletedIds.size > 0

  // 1. Every source block id survives unless explicitly deleted. Quote-agnostic so a
  //    model-rewritten edit that re-quotes the attribute still passes (it keeps the id).
  for (const b of blocks) {
    if (deletedIds.has(b.id)) continue
    const idRe = new RegExp(`data-yoai-id\\s*=\\s*["']${escapeRegExp(b.id)}["']`)
    if (!idRe.test(mergedBody)) {
      return { ok: false, reason: 'invariant_block_lost' }
    }
  }

  // 2. Top-level structural wrappers preserved (open tag must survive).
  for (const tag of ['<main', '<header', '<footer'] as const) {
    if (sourceBody.includes(tag) && !mergedBody.includes(tag)) {
      return { ok: false, reason: 'invariant_wrapper_lost' }
    }
  }

  // 3. No implausible shrink when nothing was explicitly deleted.
  if (!hasDelete && sourceBody.length > 0 && mergedBody.length < sourceBody.length * 0.5) {
    return { ok: false, reason: 'invariant_shrunk' }
  }

  return { ok: true }
}

/** Escape a string for safe literal use inside a RegExp (block ids are simple "bN"). */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Build the updated WebsitePageInput — same identity fields, new html, format html. */
function finalize(target: WebsitePage, html: string): { ok: true; page: WebsitePageInput } {
  return {
    ok: true,
    page: {
      locale: target.locale,
      slug: target.slug,
      pageRole: target.pageRole as PageRole,
      sections: [],
      seo: target.seo,
      orderIndex: target.orderIndex,
      html,
      format: 'html',
    },
  }
}

/**
 * Find the page matching slug + locale. Falls back to slug-in-default-locale if the
 * exact locale page is missing, then to the first page with that slug.
 */
function pickTargetPage(
  pages: WebsitePage[],
  slug: string,
  locale: string,
): WebsitePage | null {
  const s = (slug || '').trim() || 'home'
  const l = (locale || '').trim()
  return (
    pages.find((p) => p.slug === s && p.locale === l) ??
    pages.find((p) => p.slug === s) ??
    null
  )
}
