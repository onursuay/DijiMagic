/**
 * lib/website/codegen/patchPlannerShared.mjs
 *
 * Pure ESM core for the chat-edit PATCH PLANNER (Faz 3). Importable by BOTH:
 *   - lib/website/codegen/patchPlanner.ts   (the real Sonnet call)
 *   - scripts/verify-website-codegen.mjs    (deterministic validation assertions)
 *
 * What lives here (NO model calls — testable, deterministic):
 *   - buildPlannerSystemPrompt()                       — the planner instruction
 *   - buildPlannerUserMessage(summaries, instruction)  — block list + the command
 *   - parsePlannerOps(text)                            — tolerant JSON-array parse
 *   - validateOps(rawOps, knownIds)                    — the SECURITY gate: every
 *       targetId/after must exist (insert excepted for targetId — it is a NEW id),
 *       op ∈ ALLOWED_OPS, cap at MAX_OPS, drop/repair invalid. Returns
 *       { ops, fallback } — `fallback:true` signals "NO valid op → full regenerate".
 *
 * NO unvalidated op ever reaches mergeBlocks: applyBlockPatch passes raw planner
 * output through validateOps first; only the returned `ops` are applied.
 */

import { ALLOWED_OPS, MAX_OPS, nextBlockId } from './blockMap.mjs'

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * The planner SYSTEM prompt. Turns a free-form revise command into a small JSON
 * array of atomic block ops. Deterministic validation runs AFTER, so the prompt
 * only needs to steer the model toward the right shape — the validator is the
 * security boundary.
 *
 * @returns {string}
 */
export function buildPlannerSystemPrompt() {
  return `You are a precise web-page EDIT PLANNER. A marketing web page is split into ordered, top-level BLOCKS, each with a stable id ("b1", "b2", …) and a role (hero, services, features, stats, proof, cta, contact, footer, …).

You receive (1) the ordered block list (id · role · short text snippet) and (2) the user's natural-language change request. Your ONLY job is to translate that request into a SMALL list of ATOMIC operations on those blocks. You do NOT write any HTML.

Output STRICT JSON and nothing else — a JSON object: {"ops":[ ... ]}. No markdown, no prose, no code fences.

Each op is one of:
- {"op":"edit","targetId":"<existing block id>"}                         — rewrite the content of an existing block (e.g. change copy, restyle, darken, reword).
- {"op":"insert","targetId":"<new id you invent>","after":"<existing id>"}— add a NEW block immediately AFTER an existing block. "targetId" is a brand-new id NOT in the list (e.g. "b99"). Use "after":"" to insert at the very top.
- {"op":"delete","targetId":"<existing block id>"}                        — remove a block entirely.
- {"op":"move","targetId":"<existing block id>","after":"<existing id>"}  — move a block to sit right AFTER another block. "after":"" moves it to the top.

RULES (STRICT):
- Use the FEWEST ops that satisfy the request. Most requests are a single {"op":"edit"}.
- "edit"/"delete"/"move" targetId MUST be an id from the provided list. "after" (when present) MUST be an existing id from the list, or "" for the top.
- "insert" targetId MUST be a NEW id you invent that is NOT in the list.
- Maximum ${MAX_OPS} ops. Never touch a block the request does not mention.
- If the request is vague, global, or a full redesign ("make the whole site nicer", "redo everything", "start over") that cannot be expressed as a few block ops, return {"ops":[]} so the system can fall back to a full regeneration.
- Output ONLY the JSON object.`
}

/**
 * The planner USER message: the block summary list + the user's command.
 *
 * @param {{ id: string, role: string, snippet: string }[]} summaries
 * @param {string} instruction  the user's natural-language change request
 * @returns {string}
 */
export function buildPlannerUserMessage(summaries, instruction) {
  const list = Array.isArray(summaries) ? summaries : []
  const lines = []
  lines.push('BLOCKS (in document order):')
  if (list.length === 0) {
    lines.push('(no blocks)')
  } else {
    for (const b of list) {
      const role = b.role ? ` · role=${b.role}` : ''
      const snip = b.snippet ? ` · "${b.snippet}"` : ''
      lines.push(`- ${b.id}${role}${snip}`)
    }
  }
  lines.push('')
  lines.push("USER'S CHANGE REQUEST:")
  lines.push((typeof instruction === 'string' ? instruction : '').trim() || '(empty)')
  lines.push('')
  lines.push('Return ONLY the JSON object: {"ops":[ ... ]}.')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Tolerant parse — accept {"ops":[...]} or a bare [...] array, optionally wrapped
// in prose / code fences (mirrors translateHtml.parseTranslationArray tolerance).
// ---------------------------------------------------------------------------

/**
 * Parse the model's reply into a raw ops array. Returns [] on anything
 * unparseable (the validator then signals fallback). NEVER throws.
 *
 * @param {string | null} text
 * @returns {Array<object>}
 */
export function parsePlannerOps(text) {
  if (!text || typeof text !== 'string') return []
  const fromValue = (v) => {
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object' && Array.isArray(v.ops)) return v.ops
    return null
  }
  const tryParse = (s) => {
    try {
      return fromValue(JSON.parse(s))
    } catch {
      return null
    }
  }
  // 1. Direct parse of the trimmed text.
  const direct = tryParse(text.trim())
  if (direct) return direct.filter((o) => o && typeof o === 'object')
  // 2. Embedded object {...}.
  const fb = text.indexOf('{')
  const lb = text.lastIndexOf('}')
  if (fb >= 0 && lb > fb) {
    const obj = tryParse(text.slice(fb, lb + 1))
    if (obj) return obj.filter((o) => o && typeof o === 'object')
  }
  // 3. Embedded bare array [...].
  const fa = text.indexOf('[')
  const la = text.lastIndexOf(']')
  if (fa >= 0 && la > fa) {
    const arr = tryParse(text.slice(fa, la + 1))
    if (arr) return arr.filter((o) => o && typeof o === 'object')
  }
  return []
}

// ---------------------------------------------------------------------------
// validateOps — THE SECURITY GATE. Every op is validated against the real block
// id set before it can reach mergeBlocks. Invalid ops are dropped/repaired;
// NO valid op left → fallback to full regenerate.
// ---------------------------------------------------------------------------

/**
 * Deterministically validate + sanitize the raw planner ops against the actual
 * block id set. Pure + testable. NEVER throws.
 *
 * Validation per op:
 *   - op MUST be in ALLOWED_OPS, else dropped.
 *   - edit/delete/move: targetId MUST exist in knownIds, else dropped.
 *   - insert: targetId MUST be a NEW id (not in knownIds and not already used by a
 *             prior insert); if missing/colliding we MINT a fresh non-colliding id.
 *   - `after` (when present): MUST be an existing id (live set incl. prior inserts)
 *             or '' (top). An unknown `after` is DROPPED (treated as append-to-end),
 *             never injected.
 *   - cap at MAX_OPS (extra ops dropped).
 *
 * @param {Array<object>} rawOps
 * @param {Iterable<string>} knownIds  the ids extractBlocks() produced (the real blocks)
 * @returns {{ ops: { op: string, targetId: string, after?: string }[], fallback: boolean }}
 */
export function validateOps(rawOps, knownIds) {
  const known = new Set()
  for (const id of knownIds || []) {
    if (typeof id === 'string' && id.trim()) known.add(id.trim())
  }
  // Live id set evolves as we accept inserts/deletes so later `after` refs and
  // insert-id collisions are checked against the in-flight document, not just the
  // original. (delete removal is intentionally NOT modelled here — a later op may
  // still legitimately reference a to-be-deleted block; mergeBlocks tolerates it.)
  const live = new Set(known)
  const usedNew = new Set()

  /** @type {{ op: string, targetId: string, after?: string }[]} */
  const ops = []
  const list = Array.isArray(rawOps) ? rawOps : []

  for (const raw of list) {
    if (ops.length >= MAX_OPS) break
    if (!raw || typeof raw !== 'object') continue
    const kind = typeof raw.op === 'string' ? raw.op.trim() : ''
    if (!ALLOWED_OPS.includes(kind)) continue

    const targetId = typeof raw.targetId === 'string' ? raw.targetId.trim() : ''

    // Resolve `after` (optional). Accept '' (top) or an existing/live id. Anything
    // else → drop the field (append-to-end), never inject an unknown id.
    let after
    if (Object.prototype.hasOwnProperty.call(raw, 'after')) {
      const a = typeof raw.after === 'string' ? raw.after.trim() : ''
      if (a === '' || a === '__start__') after = ''
      else if (live.has(a)) after = a
      // unknown → leave `after` undefined (merge appends to end)
    }

    if (kind === 'edit' || kind === 'delete' || kind === 'move') {
      if (!targetId || !live.has(targetId)) continue // unknown target → drop (security)
      const op = { op: kind, targetId }
      if (after !== undefined) op.after = after
      ops.push(op)
      continue
    }

    if (kind === 'insert') {
      // insert targetId must be a FRESH id. If missing or colliding with a real /
      // already-used id, MINT one (so a confused planner can't overwrite a block).
      let newId = targetId
      if (!newId || live.has(newId) || usedNew.has(newId)) {
        newId = nextBlockId([...live, ...usedNew])
      }
      usedNew.add(newId)
      live.add(newId)
      const op = { op: 'insert', targetId: newId }
      if (after !== undefined) op.after = after
      ops.push(op)
      continue
    }
  }

  return { ops, fallback: ops.length === 0 }
}
