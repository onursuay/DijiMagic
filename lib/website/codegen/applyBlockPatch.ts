import 'server-only'
/**
 * lib/website/codegen/applyBlockPatch.ts
 *
 * Orchestrator for BLOCK-BASED chat-edit (Faz 3 — Lovable-style surgical revise).
 *
 * Flow (design doc §6):
 *   1. Load the target page (slug + locale) from the site's persisted pages.
 *   2. extractBlocks(body) — byte-exact top-level data-dijimagic-id sections.
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
 * Reuses the SAME var/data-dijimagic-* contract (block prompts in htmlGenerateShared)
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
  replaceBlockImageSrc as _replaceBlockImageSrc,
  isSafeReplaceImageUrl as _isSafeReplaceImageUrl,
  escapeAttrValue as _escapeAttrValue,
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
const coreReplaceBlockImageSrc = _replaceBlockImageSrc as (
  blockHtml: string,
  imageIndex: number,
  newUrl: string,
) => string | null
const coreIsSafeReplaceImageUrl = _isSafeReplaceImageUrl as (url: string) => boolean
const coreEscapeAttrValue = _escapeAttrValue as (s: string) => string

export interface ApplyBlockPatchInput {
  targetSlug: string
  targetLocale: string
  instruction: string
}

export type ApplyBlockPatchResult =
  | { ok: true; page: WebsitePageInput }
  | { ok: false; reason: string }

/**
 * TARGETED (manual click-select) patch — the user already picked the EXACT block
 * in the preview, so we SKIP the Sonnet planner and apply ONE deterministic op to
 * that one block id, reusing the same regenerate → merge → re-gate engine.
 *
 *   - 'edit'       → regenerate the block from literal new text (instruction = the text)
 *   - 'ai_rewrite' → regenerate the block from a natural-language instruction
 *   - 'delete'     → byte-range splice the block out (no model call)
 *
 * Same security as applyBlockPatch: targetId must be a real block id of the target
 * page; the merged body is re-sanitized + re-gated (gate fail → ok:false, NOT
 * persisted); the structural invariant guards against silent data-loss. Never
 * throws. lib/meta/* and lib/google/* untouched.
 */
export interface ApplyTargetedBlockPatchInput {
  targetSlug: string
  targetLocale: string
  targetId: string
  op: 'edit' | 'ai_rewrite' | 'delete'
  /** 'edit'/'ai_rewrite': the new text / instruction. 'delete': ignored. */
  instruction: string
}

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

/**
 * Apply a TARGETED manual patch (click-select) to ONE block of ONE page. The
 * planner is bypassed (the user selected the exact block); we build the single op
 * for `targetId` directly and run it through the SAME regenerate/merge/gate engine.
 *
 * @returns { ok:true, page } on a gated success; { ok:false, reason } otherwise.
 *          NEVER throws (every failure path returns ok:false).
 */
export async function applyTargetedBlockPatch(
  userId: string,
  website: Website,
  input: ApplyTargetedBlockPatchInput,
): Promise<ApplyBlockPatchResult> {
  const op = input.op
  const targetId = (input.targetId || '').trim()
  const instruction = (input.instruction || '').trim()
  if (op !== 'delete' && !instruction) return { ok: false, reason: 'no_instruction' }
  if (!/^b\d+$/.test(targetId)) return { ok: false, reason: 'bad_target' }

  try {
    // 1. Load the target page (slug + locale). Must be an html-format page.
    const pages = await getPages(userId, website.id)
    const target = pickTargetPage(pages, input.targetSlug, input.targetLocale)
    if (!target) return { ok: false, reason: 'page_not_found' }
    const sourceBody = typeof target.html === 'string' ? target.html : ''
    if (target.format !== 'html' || !sourceBody) return { ok: false, reason: 'not_html_page' }

    // 2. Byte-exact top-level blocks; the selected id MUST be a real block.
    const blocks = coreExtractBlocks(sourceBody)
    if (blocks.length === 0) return { ok: false, reason: 'no_blocks' }
    const cur = blocks.find((b) => b.id === targetId)
    if (!cur) return { ok: false, reason: 'target_not_found' }

    // 3. DELETE — no model call; splice the block out, then re-gate.
    if (op === 'delete') {
      // Guard: refuse to delete the LAST remaining block (would gut the page).
      if (blocks.length <= 1) return { ok: false, reason: 'cannot_delete_last' }
      const ops: PatchOp[] = [{ op: 'delete', targetId }]
      const merged = coreMergeBlocks(sourceBody, blocks, ops, {})
      if (!merged) return { ok: false, reason: 'empty_merge' }
      const inv = assertStructuralInvariants(sourceBody, merged, blocks, ops)
      if (!inv.ok) return { ok: false, reason: inv.reason }
      const gate = gateSiteHtml(merged)
      if (gate.ok === false) return { ok: false, reason: gate.reason }
      return finalize(target, gate.html)
    }

    // 4. EDIT / AI_REWRITE — regenerate just this block, then merge + re-gate.
    //    'edit' carries the literal new text; 'ai_rewrite' a free-form instruction.
    //    Both flow through the SAME block prompt (regenerateBlock 'edit' kind),
    //    keeping the var/data-dijimagic-* contract + image resolution identical.
    const blockInstruction =
      op === 'edit'
        ? `Bu bölümün ana metnini aşağıdaki yeni metinle güncelle; düzen, sınıflar ve görseller korunur. Yeni metin: ${instruction}`
        : instruction

    const ctx = await buildCodegenContext(userId, website, {
      instructions: blockInstruction,
      revisionMode: 'edit',
    })
    const ds = await generateDesignSystem(ctx)

    const ops: PatchOp[] = [{ op: 'edit', targetId }]

    // ONE self-repair: a transient bad block can be fixed by a second pass.
    const first = await regenMergeGate(ctx, ds, sourceBody, blocks, cur, ops, blockInstruction)
    if (first.ok) return finalize(target, first.html)
    const second = await regenMergeGate(ctx, ds, sourceBody, blocks, cur, ops, blockInstruction)
    if (second.ok) return finalize(target, second.html)
    return { ok: false, reason: second.reason || first.reason || 'gate_failed' }
  } catch (e) {
    console.warn('[applyTargetedBlockPatch] soft-fail:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'patch_failed' }
  }
}

/**
 * Regenerate the single selected block, splice it onto the ORIGINAL body, run the
 * structural invariant + publish gate. Untouched blocks stay BYTE-IDENTICAL.
 */
async function regenMergeGate(
  ctx: CodegenContext,
  ds: DesignSystem,
  sourceBody: string,
  blocks: Block[],
  cur: Block,
  ops: PatchOp[],
  instruction: string,
): Promise<{ ok: true; html: string } | { ok: false; reason: string }> {
  let newHtml: string
  try {
    newHtml = await regenerateBlock(ctx, ds, 'edit', cur, instruction)
  } catch (e) {
    console.warn('[applyTargetedBlockPatch] block regen failed:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'block_regen_failed' }
  }
  const merged = coreMergeBlocks(sourceBody, blocks, ops, { [cur.id]: newHtml })
  if (!merged) return { ok: false, reason: 'empty_merge' }
  const inv = assertStructuralInvariants(sourceBody, merged, blocks, ops)
  if (!inv.ok) return { ok: false, reason: inv.reason }
  const gate = gateSiteHtml(merged)
  if (gate.ok === false) return { ok: false, reason: gate.reason }
  return { ok: true, html: gate.html }
}

/**
 * Replace ONE image's src inside ONE block (manual "Görseli değiştir"). FULLY
 * DETERMINISTIC — no model call, no network: we locate the block, swap the <img> at
 * `imageIndex` for `newUrl` (https-only; the original alt + every other attribute is
 * preserved), then merge + re-sanitize + re-gate the whole body. Untouched blocks
 * stay BYTE-IDENTICAL.
 *
 * Security:
 *   - targetId must be a real block id (^b\d+$, present on the page).
 *   - newUrl MUST be an absolute https URL (isSafeReplaceImageUrl) — javascript:,
 *     data:, vbscript:, relative, quote/space-bearing values are REJECTED here. Our
 *     own stored uploads are https Supabase URLs, so they pass.
 *   - The merged body is re-sanitized + re-gated; the sanitizer's img allowlist keeps
 *     https srcs (SAFE_IMG_SRC_RE) and would strip anything unsafe that slipped in.
 *     Gate fail → ok:false, NOT persisted.
 *   - imageIndex is clamped to a valid range (out of range → ok:false).
 * Never throws. lib/meta/* and lib/google/* untouched.
 */
export interface ApplyImageReplaceInput {
  targetSlug: string
  targetLocale: string
  targetId: string
  imageIndex: number
  newUrl: string
}

export async function applyImageReplacePatch(
  userId: string,
  website: Website,
  input: ApplyImageReplaceInput,
): Promise<ApplyBlockPatchResult> {
  const targetId = (input.targetId || '').trim()
  const newUrl = (input.newUrl || '').trim()
  const imageIndex = Number.isInteger(input.imageIndex) ? input.imageIndex : -1

  if (!/^b\d+$/.test(targetId)) return { ok: false, reason: 'bad_target' }
  if (imageIndex < 0) return { ok: false, reason: 'bad_image_index' }
  if (!coreIsSafeReplaceImageUrl(newUrl)) return { ok: false, reason: 'bad_url' }

  try {
    // 1. Load the target page (slug + locale). Must be an html-format page.
    const pages = await getPages(userId, website.id)
    const target = pickTargetPage(pages, input.targetSlug, input.targetLocale)
    if (!target) return { ok: false, reason: 'page_not_found' }
    const sourceBody = typeof target.html === 'string' ? target.html : ''
    if (target.format !== 'html' || !sourceBody) return { ok: false, reason: 'not_html_page' }

    // 2. Byte-exact top-level blocks; the selected id MUST be a real block with images.
    const blocks = coreExtractBlocks(sourceBody)
    if (blocks.length === 0) return { ok: false, reason: 'no_blocks' }
    const cur = blocks.find((b) => b.id === targetId)
    if (!cur) return { ok: false, reason: 'target_not_found' }

    // 3. Deterministic image-src swap inside the block (alt + all else preserved).
    const newBlockHtml = coreReplaceBlockImageSrc(cur.html, imageIndex, newUrl)
    if (newBlockHtml === null) return { ok: false, reason: 'image_not_found' }
    if (newBlockHtml === cur.html) return { ok: false, reason: 'image_unchanged' }

    // 4. Byte-splice the rewritten block onto the original body (others byte-identical).
    const ops: PatchOp[] = [{ op: 'edit', targetId }]
    const merged = coreMergeBlocks(sourceBody, blocks, ops, { [targetId]: newBlockHtml })
    if (!merged) return { ok: false, reason: 'empty_merge' }

    // 5. Structural invariant + the SAME publish gate (sanitize → structure → size).
    //    The sanitizer re-checks every img src; an unsafe src can never persist.
    const inv = assertStructuralInvariants(sourceBody, merged, blocks, ops)
    if (!inv.ok) return { ok: false, reason: inv.reason }
    const gate = gateSiteHtml(merged)
    if (gate.ok === false) return { ok: false, reason: gate.reason }

    // 6. Defense-in-depth: the new https url MUST survive the gate (i.e. the sanitizer
    //    kept it). If it was stripped, refuse to persist a broken/blank image.
    //    NOTE: the src is written attribute-escaped (swapImgSrc → escapeAttrValue) and
    //    sanitize-html entity-encodes `&` → `&amp;`, so a query-string url (Pexels /
    //    Unsplash: `…?auto=compress&cs=tinysrgb`) lives in gate.html as `&amp;`, NOT
    //    raw `&`. Match the EXACT newUrl in either form — raw OR its escaped form — so
    //    the check stays strict (a stripped/altered src still fails) but tolerates the
    //    encoding. We never widen to a substring/partial match.
    const survived =
      gate.html.includes(newUrl) || gate.html.includes(coreEscapeAttrValue(newUrl))
    if (!survived) return { ok: false, reason: 'src_stripped' }

    return finalize(target, gate.html)
  } catch (e) {
    console.warn('[applyImageReplacePatch] soft-fail:', e instanceof Error ? e.message : e)
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
 *   1. NO SILENT DISAPPEARANCE — every data-dijimagic-id present in the source is still
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
    const idRe = new RegExp(`data-dijimagic-id\\s*=\\s*["']${escapeRegExp(b.id)}["']`)
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
