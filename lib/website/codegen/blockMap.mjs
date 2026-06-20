/**
 * lib/website/codegen/blockMap.mjs
 *
 * Pure ESM core for BLOCK-BASED chat-edit (Faz 3 — Lovable-style surgical
 * revision). Importable by BOTH:
 *   - lib/website/codegen/applyBlockPatch.ts  (the orchestrator + Sonnet calls)
 *   - scripts/verify-website-codegen.mjs       (unit assertions, no live API)
 *
 * What lives here (the testable, deterministic glue — NO model calls):
 *   - extractBlocks(bodyHtml)         → [{ id, role, html, start, end }] — EVERY
 *                                        element carrying data-yoai-id, anywhere in
 *                                        the tree (incl. nested inside <main>), in
 *                                        document order. `start`/`end` are the
 *                                        byte offsets of the block's outerHTML in
 *                                        the ORIGINAL bodyHtml string; `html` is the
 *                                        BYTE-EXACT slice (no re-serialization).
 *   - summarizeBlocks(blocks)         → [{ id, role, snippet }] — first ~120 chars of
 *                                        visible text per block (cheap planner input).
 *   - mergeBlocks(originalBody, blocks, ops, newHtmlById) → bodyHtml — apply atomic
 *                                        ops as BYTE-RANGE SPLICES on the ORIGINAL
 *                                        body string. Everything NOT in an op's range
 *                                        — the <main> open/close tags, whitespace,
 *                                        untouched blocks — stays BYTE-IDENTICAL
 *                                        because the original string is never rebuilt,
 *                                        only spliced.
 *   - nextBlockId(existingIds)        → a fresh, non-colliding "bN" id for inserts.
 *
 * BYTE-IDENTITY CONTRACT (the whole point of block-patch):
 *   The generator marks each top-level marketing section with data-yoai-block="<role>"
 *   + data-yoai-id="b1","b2",… (htmlGenerateShared prompt) and wraps the content
 *   sections in a single <main> (the <header> sits above it, the <footer> below). We
 *   parse with the htmlparser2 backend (NOT parse5) + withStartIndices/withEndIndices
 *   so every tag node exposes node.startIndex / node.endIndex relative to the input
 *   string. extractBlocks descends the WHOLE tree to find every data-yoai-id block
 *   (so the sections inside <main> are NOT invisible), and mergeBlocks splices the
 *   ORIGINAL body string at those exact offsets — the <main> wrapper, inter-block
 *   whitespace and any block we did not touch survive byte-for-byte. Only the blocks
 *   the planner targeted carry model-rewritten HTML.
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
// extractBlocks — EVERY data-yoai-id element (whole tree), byte-exact slices.
// ---------------------------------------------------------------------------

/**
 * Parse the body HTML and return every element that carries a data-yoai-id,
 * ANYWHERE in the tree (descending into <main> and any other wrapper), in document
 * order. Each block's `html` is a BYTE-EXACT slice of the input (no
 * re-serialization), so an untouched block merges back identically; `start`/`end`
 * are the byte offsets of that slice in the ORIGINAL bodyHtml string.
 *
 * TOP-MOST only: a data-yoai-id element nested inside ANOTHER data-yoai-id element
 * (which should never happen per the contract) is NOT double-counted — once we
 * accept a block we do not descend into it.
 *
 * @param {string} bodyHtml
 * @returns {{ id: string, role: string, html: string, start: number, end: number }[]}
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

  /** @type {{ id: string, role: string, html: string, start: number, end: number }[]} */
  const blocks = []
  const seen = new Set()

  // Depth-first walk of the WHOLE tree. When we hit an element carrying a (fresh)
  // data-yoai-id we record it as a block and DO NOT descend into it (top-most wins,
  // so an id nested inside a block can never split it). Any element without a
  // data-yoai-id — including the <main>/<header>/<footer> wrappers — is descended
  // into so the sections inside <main> are found.
  /** @param {any[]} nodes */
  const walk = (nodes) => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (!node || node.type !== 'tag') continue
      const attribs = node.attribs || {}
      const rawId = typeof attribs['data-yoai-id'] === 'string' ? attribs['data-yoai-id'].trim() : ''
      const hasIndices =
        typeof node.startIndex === 'number' && typeof node.endIndex === 'number'

      if (rawId && hasIndices && !seen.has(rawId)) {
        const role =
          typeof attribs['data-yoai-block'] === 'string'
            ? attribs['data-yoai-block'].trim()
            : ''
        const start = node.startIndex
        const end = node.endIndex + 1 // exclusive end → slice(start, end) is outerHTML
        const html = bodyHtml.slice(start, end)
        seen.add(rawId)
        blocks.push({ id: rawId, role, html, start, end })
        // TOP-MOST: do not descend into a block we already accepted.
        continue
      }

      // Not a block (or a duplicate id) → keep descending to find nested blocks.
      if (Array.isArray(node.children) && node.children.length) walk(node.children)
    }
  }

  const rootNode = $.root().get(0)
  walk(rootNode && Array.isArray(rootNode.children) ? rootNode.children : [])

  // Document order = ascending byte offset (the DFS already yields this, but sort
  // defensively so callers can rely on it regardless of traversal quirks).
  blocks.sort((a, b) => a.start - b.start)
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
// replaceBlockImageSrc — DETERMINISTIC <img> src swap inside ONE block (no model).
// ---------------------------------------------------------------------------

/**
 * The ONLY src scheme allowed for a replaced image: an absolute https URL. This is
 * a hard wall against javascript:/data:/vbscript:/relative smuggling at the deepest
 * layer (the route validates too, sanitize re-checks after merge — defense in depth).
 * Our own stored uploads (Supabase Storage public URLs) are https:// too, so they
 * pass without a special case.
 */
const SAFE_REPLACE_IMG_SRC_RE = /^https:\/\/[^\s"'<>]+$/i

/** True iff `url` is a safe replacement image src (absolute https, no quotes/spaces). */
export function isSafeReplaceImageUrl(url) {
  return typeof url === 'string' && SAFE_REPLACE_IMG_SRC_RE.test(url.trim())
}

/**
 * Replace the `src` of the <img> at `imageIndex` (0-based, among the block's images
 * in document order) inside ONE block's HTML, returning the new BLOCK html. Pure +
 * deterministic — no model, no network. The original `alt` (and every other attr,
 * and all other markup) is preserved; ONLY that one image's src changes.
 *
 * Returns null on any failure (bad url, no images, index out of range, parse error)
 * so the caller can soft-fail without mutating anything.
 *
 * @param {string} blockHtml  the block's outerHTML (a single top-level element)
 * @param {number} imageIndex 0-based index among the block's <img> elements
 * @param {string} newUrl     absolute https URL (validated here AND by the caller)
 * @returns {string|null}     the new block html, or null
 */
export function replaceBlockImageSrc(blockHtml, imageIndex, newUrl) {
  if (typeof blockHtml !== 'string' || !blockHtml) return null
  if (!Number.isInteger(imageIndex) || imageIndex < 0) return null
  const url = typeof newUrl === 'string' ? newUrl.trim() : ''
  if (!isSafeReplaceImageUrl(url)) return null

  let $
  try {
    // Index tracking so we can byte-splice the ONE img tag (no re-serialization of
    // the whole block → every other byte, attribute order + quoting, stays intact).
    $ = load(blockHtml, { withStartIndices: true, withEndIndices: true, _useHtmlParser2: true }, false)
  } catch {
    return null
  }

  // Collect <img> nodes in document order (depth-first), with their byte ranges.
  /** @type {any[]} */
  const imgs = []
  const collect = (nodes) => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (!node || node.type !== 'tag') continue
      if (node.name === 'img') imgs.push(node)
      if (Array.isArray(node.children) && node.children.length) collect(node.children)
    }
  }
  const rootNode = $.root().get(0)
  collect(rootNode && Array.isArray(rootNode.children) ? rootNode.children : [])

  if (imageIndex >= imgs.length) return null
  const img = imgs[imageIndex]
  if (typeof img.startIndex !== 'number' || typeof img.endIndex !== 'number') return null

  // Slice out the exact original <img …> tag, swap ONLY its src, splice it back.
  const tagStart = img.startIndex
  const tagEnd = img.endIndex + 1
  const originalTag = blockHtml.slice(tagStart, tagEnd)
  const newTag = swapImgSrc(originalTag, url)
  if (newTag === null) return null

  return blockHtml.slice(0, tagStart) + newTag + blockHtml.slice(tagEnd)
}

/**
 * Swap the `src="…"` value of a single <img …> tag string. If the tag has no src,
 * one is inserted right after `<img`. The new value is the ALREADY-VALIDATED https
 * url; it is HTML-attribute-escaped (no raw quotes/angle brackets can survive — and
 * the scheme is https so there's nothing to break out of). Returns null if the input
 * doesn't look like an <img> tag.
 *
 * @param {string} tag    e.g. `<img src="old.jpg" alt="x">`
 * @param {string} url    safe absolute https url (validated by caller)
 * @returns {string|null}
 */
function swapImgSrc(tag, url) {
  if (typeof tag !== 'string' || !/^<img\b/i.test(tag)) return null
  const safe = escapeAttr(url)
  // Replace an existing src="…" or src='…' (first occurrence). Match double- or
  // single-quoted only — the generator always quotes attributes; an unquoted src is
  // treated as "no src" and we insert a fresh one (never leaves an old value behind).
  const srcRe = /\ssrc\s*=\s*("[^"]*"|'[^']*')/i
  if (srcRe.test(tag)) {
    return tag.replace(srcRe, ` src="${safe}"`)
  }
  // No quoted src → insert one immediately after `<img`.
  return tag.replace(/^<img\b/i, `<img src="${safe}"`)
}

/** Minimal HTML attribute-value escape (the url is https; this is belt-and-braces). */
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ---------------------------------------------------------------------------
// mergeBlocks — BYTE-RANGE SPLICES on the ORIGINAL body (structure preserved).
// ---------------------------------------------------------------------------

/**
 * Apply the (already-validated) atomic ops to the ORIGINAL body string as
 * byte-range splices, NOT by reassembling a block list. Because we only ever
 * splice the original string, everything NOT in an op's target range — the
 * <main> open/close tags, the <header>/<footer> wrappers, inter-block whitespace
 * and any untouched block — stays BYTE-IDENTICAL automatically.
 *
 * Op semantics (deterministic):
 *   - edit   {targetId}            → replace the block's [start,end) with newHtmlById[targetId]
 *   - delete {targetId}            → remove the block's [start,end)
 *   - insert {targetId, after?}    → insert a NEW block (html=newHtmlById[targetId]) right
 *                                    after the `after` block's end (or after the op's
 *                                    anchor block when `after` is omitted; or at the very
 *                                    FRONT when after===''/'__start__'; or at the END when
 *                                    `after` is unknown)
 *   - move   {targetId, after?}    → remove the block from its old range and re-insert its
 *                                    HTML after `after`'s end (same position rules as insert)
 *
 * Implementation: we build a flat list of {at, deleteLen, text} mutations against the
 * ORIGINAL body, then apply them in DESCENDING `at` order so earlier byte offsets
 * stay valid while later splices are applied. Insert/move anchor positions are
 * resolved against the ORIGINAL block offsets (stable, since splices run last).
 *
 * @param {string} originalBody  the EXACT source body the blocks were extracted from
 * @param {{ id: string, role: string, html: string, start: number, end: number }[]} blocks
 * @param {{ op: string, targetId: string, after?: string }[]} ops
 * @param {Record<string,string>} newHtmlById  new HTML for edited/inserted blocks (keyed by targetId)
 * @returns {string} the spliced body HTML
 */
export function mergeBlocks(originalBody, blocks, ops, newHtmlById) {
  const body = typeof originalBody === 'string' ? originalBody : ''
  const blockList = Array.isArray(blocks) ? blocks : []
  const newHtml = newHtmlById && typeof newHtmlById === 'object' ? newHtmlById : {}
  const opList = Array.isArray(ops) ? ops : []

  // id → original block (with byte range). Insert anchors / edit / delete / move all
  // resolve against the ORIGINAL offsets.
  const byId = new Map()
  for (const b of blockList) {
    if (b && typeof b.id === 'string') byId.set(b.id, b)
  }

  // The byte offset to insert AFTER, given an `after` id:
  //   - '' / '__start__' → very front (offset 0)
  //   - a known block    → that block's end offset
  //   - absent/unknown   → end of body (append)
  const insertOffsetAfter = (after) => {
    if (after === '' || after === '__start__') return 0
    const anchor = typeof after === 'string' ? byId.get(after) : undefined
    return anchor ? anchor.end : body.length
  }

  /** @type {{ at: number, deleteLen: number, text: string, seq: number }[]} */
  const mutations = []
  let seq = 0

  for (const op of opList) {
    if (!op || typeof op !== 'object') continue
    const kind = op.op
    const targetId = op.targetId

    if (kind === 'edit') {
      const cur = byId.get(targetId)
      if (!cur) continue
      const replacement = newHtml[targetId]
      if (typeof replacement !== 'string' || !replacement) continue
      mutations.push({ at: cur.start, deleteLen: cur.end - cur.start, text: replacement, seq: seq++ })
      continue
    }

    if (kind === 'delete') {
      const cur = byId.get(targetId)
      if (!cur) continue
      mutations.push({ at: cur.start, deleteLen: cur.end - cur.start, text: '', seq: seq++ })
      continue
    }

    if (kind === 'insert') {
      const html = newHtml[targetId]
      if (typeof html !== 'string' || !html) continue
      // `after` defaults to the op's anchor block when omitted (insert right after it).
      const after = Object.prototype.hasOwnProperty.call(op, 'after') ? op.after : op.anchorId
      const at = insertOffsetAfter(after)
      // Separate the inserted block from its neighbours with a newline (matches the
      // generator's one-section-per-line layout); never deletes original bytes.
      mutations.push({ at, deleteLen: 0, text: `\n${html}`, seq: seq++ })
      continue
    }

    if (kind === 'move') {
      const cur = byId.get(targetId)
      if (!cur) continue
      // 1. Remove the block from its original range.
      mutations.push({ at: cur.start, deleteLen: cur.end - cur.start, text: '', seq: seq++ })
      // 2. Re-insert its (original byte-exact) HTML at the new anchor position.
      const at = insertOffsetAfter(op.after)
      mutations.push({ at, deleteLen: 0, text: `\n${cur.html}`, seq: seq++ })
      continue
    }
    // Unknown op → ignored (planner validation should have dropped it).
  }

  if (mutations.length === 0) return body

  // Apply in DESCENDING `at` (later edits first → earlier offsets stay valid). For
  // mutations at the SAME offset (e.g. an insert anchored at a block we also edit),
  // apply in REVERSE op order so the visual order matches op order: a later insert
  // at offset X is spliced before an earlier one, leaving the earlier one nearer X.
  mutations.sort((a, b) => (b.at - a.at) || (b.seq - a.seq))

  let out = body
  for (const m of mutations) {
    out = out.slice(0, m.at) + m.text + out.slice(m.at + m.deleteLen)
  }
  return out
}
