/**
 * lib/website/codegen/blockMap.mjs
 *
 * Pure ESM core for BLOCK-BASED chat-edit (Faz 3 — Lovable-style surgical
 * revision). Importable by BOTH:
 *   - lib/website/codegen/applyBlockPatch.ts  (the orchestrator + Sonnet calls)
 *   - scripts/verify-website-codegen.mjs       (unit assertions, no live API)
 *
 * What lives here (the testable, deterministic glue — NO model calls):
 *   - extractBlocks(bodyHtml)         → [{ id, role, html }] — TOP-LEVEL sections
 *                                        carrying data-yoai-id, in document order.
 *                                        `html` is a BYTE-EXACT slice of the source
 *                                        (cheerio htmlparser2 start/end indices), so
 *                                        an untouched block round-trips byte-for-byte.
 *   - summarizeBlocks(blocks)         → [{ id, role, snippet }] — first ~120 chars of
 *                                        visible text per block (cheap planner input).
 *   - mergeBlocks(originalBlocks, ops, newHtmlById) → bodyHtml — apply atomic ops
 *                                        deterministically; UNTOUCHED blocks keep their
 *                                        EXACT original `html` string (byte-identical);
 *                                        order preserved except move/insert/delete.
 *   - nextBlockId(existingIds)        → a fresh, non-colliding "bN" id for inserts.
 *
 * BYTE-IDENTITY CONTRACT (the whole point of block-patch):
 *   The generator marks each top-level section with data-yoai-block="<role>" +
 *   data-yoai-id="b1","b2",… (htmlGenerateShared prompt). We parse with the
 *   htmlparser2 backend (NOT parse5) + withStartIndices/withEndIndices so every
 *   tag node exposes node.startIndex / node.endIndex. extractBlocks slices the
 *   ORIGINAL source string between those offsets — it NEVER re-serializes — so a
 *   block we did not touch is returned and re-merged with the identical bytes it
 *   came in with. Only the blocks the planner targeted carry model-rewritten HTML.
 */

import { load } from 'cheerio'

// ---------------------------------------------------------------------------
// Constants — the atomic op set + caps (mirrors design doc §6).
// ---------------------------------------------------------------------------

/** The allowed planner operations. */
export const ALLOWED_OPS = ['edit', 'insert', 'delete', 'move']

/** Hard cap on ops applied per patch (planner validation enforces this too). */
export const MAX_OPS = 8

/** Snippet length for the cheap planner summary (visible text per block). */
const SNIPPET_LEN = 120

// ---------------------------------------------------------------------------
// extractBlocks — TOP-LEVEL data-yoai-id sections, byte-exact outerHTML.
// ---------------------------------------------------------------------------

/**
 * Parse the body HTML and return every TOP-LEVEL element that carries a
 * data-yoai-id, in document order. Each block's `html` is a BYTE-EXACT slice of
 * the input (no re-serialization), so untouched blocks merge back identically.
 *
 * "Top-level" = a direct child of the parsed fragment root that carries
 * data-yoai-id. (The generator emits one such element per marketing section; a
 * <main>/<header>/<footer> wrapper that itself carries the id counts as the block.)
 *
 * @param {string} bodyHtml
 * @returns {{ id: string, role: string, html: string }[]}
 */
export function extractBlocks(bodyHtml) {
  if (typeof bodyHtml !== 'string' || !bodyHtml) return []

  let $
  try {
    // htmlparser2 backend + index tracking → node.startIndex / node.endIndex.
    // Fragment mode (3rd arg false) so we don't get a synthetic <html>/<body>.
    $ = load(
      bodyHtml,
      { withStartIndices: true, withEndIndices: true, _useHtmlParser2: true },
      false,
    )
  } catch {
    return []
  }

  /** @type {{ id: string, role: string, html: string }[]} */
  const blocks = []
  const seen = new Set()

  // Walk only the TOP-LEVEL nodes (direct children of the fragment root). A block
  // is a top-level tag that carries data-yoai-id. We do NOT descend — nested
  // data-yoai-id (should not happen per the contract) is ignored on purpose so an
  // id collision can never split a block.
  // $.root() is the single wrapper node; its children are the actual top-level nodes.
  const rootNode = $.root().get(0)
  const topLevel = rootNode && Array.isArray(rootNode.children) ? rootNode.children : []
  for (const node of topLevel) {
    if (!node || node.type !== 'tag') continue
    const attribs = node.attribs || {}
    const id = typeof attribs['data-yoai-id'] === 'string' ? attribs['data-yoai-id'].trim() : ''
    if (!id || seen.has(id)) continue
    if (typeof node.startIndex !== 'number' || typeof node.endIndex !== 'number') continue
    const role =
      typeof attribs['data-yoai-block'] === 'string' ? attribs['data-yoai-block'].trim() : ''
    // BYTE-EXACT outerHTML: slice the ORIGINAL source between the parser offsets.
    const html = bodyHtml.slice(node.startIndex, node.endIndex + 1)
    seen.add(id)
    blocks.push({ id, role, html })
  }

  return blocks
}

// ---------------------------------------------------------------------------
// summarizeBlocks — cheap planner input (id + role + short visible-text snippet).
// ---------------------------------------------------------------------------

/**
 * Collapse a block's visible text to a short snippet (the planner only needs to
 * know WHAT each block is, not its full markup — keeps the planner cheap).
 *
 * @param {{ id: string, role: string, html: string }[]} blocks
 * @returns {{ id: string, role: string, snippet: string }[]}
 */
export function summarizeBlocks(blocks) {
  const list = Array.isArray(blocks) ? blocks : []
  return list.map((b) => ({
    id: b.id,
    role: b.role || '',
    snippet: blockSnippet(b.html),
  }))
}

/**
 * Extract the first ~120 chars of VISIBLE text from a block's HTML.
 * cheerio .text() drops tags; we collapse whitespace + clamp on a word boundary.
 *
 * @param {string} html
 * @returns {string}
 */
function blockSnippet(html) {
  if (typeof html !== 'string' || !html) return ''
  let text = ''
  try {
    const $ = load(html, { _useHtmlParser2: true }, false)
    text = $.root().text() || ''
  } catch {
    text = ''
  }
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= SNIPPET_LEN) return collapsed
  return collapsed.slice(0, SNIPPET_LEN).replace(/\s+\S*$/, '').trim()
}

// ---------------------------------------------------------------------------
// nextBlockId — a fresh, non-colliding "bN" id for inserted blocks.
// ---------------------------------------------------------------------------

/**
 * Return the smallest "bN" id (N ≥ 1) that is NOT already present.
 * Inserted blocks get a fresh id so ids stay stable + unique across a patch.
 *
 * @param {Iterable<string>} existingIds
 * @returns {string}
 */
export function nextBlockId(existingIds) {
  const used = new Set()
  for (const id of existingIds || []) {
    const m = /^b(\d+)$/.exec(typeof id === 'string' ? id.trim() : '')
    if (m) used.add(Number(m[1]))
  }
  let n = 1
  while (used.has(n)) n += 1
  return `b${n}`
}

// ---------------------------------------------------------------------------
// mergeBlocks — apply atomic ops; UNTOUCHED blocks stay byte-identical.
// ---------------------------------------------------------------------------

/**
 * Apply the (already-validated) atomic ops to the original block list and
 * reassemble the body HTML. The ordered output is the join of each surviving
 * block's `html` (the SAME byte string for untouched blocks; the model-rewritten
 * string from newHtmlById for edited/inserted blocks), separated by a single "\n".
 *
 * Op semantics (deterministic):
 *   - edit   {targetId}            → replace that block's html with newHtmlById[targetId]
 *   - delete {targetId}            → drop that block
 *   - insert {targetId, after?}    → splice a NEW block (html=newHtmlById[targetId]) AFTER
 *                                    the `after` block (or at end if `after` absent/unknown)
 *   - move   {targetId, after?}    → remove the block, re-insert AFTER `after`
 *                                    (or at end if `after` absent/unknown). after===''/'__start__'
 *                                    → move to the FRONT.
 *
 * Untouched blocks are NEVER passed through cheerio again → byte-identical.
 *
 * @param {{ id: string, role: string, html: string }[]} originalBlocks
 * @param {{ op: string, targetId: string, after?: string }[]} ops
 * @param {Record<string,string>} newHtmlById  new HTML for edited/inserted blocks (keyed by targetId)
 * @returns {string} the reassembled body HTML
 */
export function mergeBlocks(originalBlocks, ops, newHtmlById) {
  // Working list of { id, role, html } — start from a shallow copy of the originals.
  const list = (Array.isArray(originalBlocks) ? originalBlocks : []).map((b) => ({
    id: b.id,
    role: b.role || '',
    html: b.html,
  }))
  const newHtml = newHtmlById && typeof newHtmlById === 'object' ? newHtmlById : {}
  const opList = Array.isArray(ops) ? ops : []

  const indexOfId = (id) => list.findIndex((b) => b.id === id)

  // Compute the splice position AFTER a given `after` id. Front when after is the
  // explicit start sentinel; end when after is absent/unknown.
  const positionAfter = (after) => {
    if (after === '' || after === '__start__') return 0
    const idx = typeof after === 'string' ? indexOfId(after) : -1
    return idx === -1 ? list.length : idx + 1
  }

  for (const op of opList) {
    if (!op || typeof op !== 'object') continue
    const kind = op.op
    const targetId = op.targetId

    if (kind === 'edit') {
      const idx = indexOfId(targetId)
      if (idx === -1) continue
      const replacement = newHtml[targetId]
      if (typeof replacement === 'string' && replacement) list[idx].html = replacement
      continue
    }

    if (kind === 'delete') {
      const idx = indexOfId(targetId)
      if (idx !== -1) list.splice(idx, 1)
      continue
    }

    if (kind === 'insert') {
      const html = newHtml[targetId]
      if (typeof html !== 'string' || !html) continue
      // `after` defaults to the anchor block when omitted (insert right after target).
      const after = Object.prototype.hasOwnProperty.call(op, 'after') ? op.after : op.anchorId
      const pos = positionAfter(after)
      list.splice(pos, 0, { id: targetId, role: '', html })
      continue
    }

    if (kind === 'move') {
      const idx = indexOfId(targetId)
      if (idx === -1) continue
      const [moved] = list.splice(idx, 1)
      // Recompute the position AFTER removal so indices are correct.
      let pos = positionAfter(op.after)
      // positionAfter used the post-removal list, which is what we want.
      if (pos > list.length) pos = list.length
      list.splice(pos, 0, moved)
      continue
    }
    // Unknown op → ignored (planner validation should have dropped it).
  }

  return list.map((b) => b.html).join('\n')
}
