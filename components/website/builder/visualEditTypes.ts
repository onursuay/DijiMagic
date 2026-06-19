/**
 * #builder-8b — shared types for the visual-edit select layer.
 *
 * The canvas iframe stays sandboxed `allow-scripts` (NO same-origin); the ONLY
 * channel is postMessage. These types describe the validated `yoai:select` payload
 * the parent (VisualEditLayer) accepts, plus the parent's selection state.
 */

/** A rect in the IFRAME's own viewport coordinate space (before device scale). */
export interface IframeRect {
  left: number
  top: number
  width: number
  height: number
}

/** A validated, parent-side selection (built from a trusted `yoai:select` message). */
export interface VisualSelection {
  /** data-yoai-id of the selected block (e.g. 'b3'). */
  blockId: string
  /** data-yoai-block (the component registry key, e.g. 'hero.split-image') or ''. */
  blockKey: string
  /** Optional data-yoai-field the click landed on (future-proofing; usually undefined). */
  field?: string
  /** The block's bounding box in the iframe coordinate space. */
  rect: IframeRect
  /** A short visible-text snippet of the block (inspector preview). */
  text: string
  /** Ordered list of every top-level block id (document order) — drives move up/down. */
  order: string[]
}

/** The visual-edit PATCH ops the parent can dispatch (mirror the /patch route). */
export type VisualEditOp = 'edit' | 'ai_rewrite' | 'delete' | 'move'

/**
 * Validate + normalize an untrusted postMessage payload into a VisualSelection.
 * Returns null if the shape is wrong (the parent ignores it). NEVER trusts arbitrary
 * fields — only the known keys are read, with type + bound checks.
 */
export function parseSelectMessage(data: unknown): VisualSelection | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (d.type !== 'yoai:select') return null
  const blockId = typeof d.blockId === 'string' ? d.blockId.trim() : ''
  // The block id contract is a simple "bN" — reject anything else.
  if (!/^b\d+$/.test(blockId)) return null
  const blockKey = typeof d.blockKey === 'string' ? d.blockKey.trim() : ''
  const field = typeof d.field === 'string' && d.field.trim() ? d.field.trim() : undefined
  const text = typeof d.text === 'string' ? d.text.slice(0, 240) : ''
  const rect = parseRect(d.rect)
  if (!rect) return null
  // Order: only well-formed "bN" ids, deduped, capped (defense against a huge payload).
  const order = Array.isArray(d.order)
    ? Array.from(
        new Set(
          d.order
            .filter((x): x is string => typeof x === 'string' && /^b\d+$/.test(x.trim()))
            .map((x) => x.trim()),
        ),
      ).slice(0, 64)
    : []
  return { blockId, blockKey, field, rect, text, order }
}

/** Validate a rect payload (finite numbers only). */
export function parseRect(raw: unknown): IframeRect | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const left = Number(r.left)
  const top = Number(r.top)
  const width = Number(r.width)
  const height = Number(r.height)
  if (![left, top, width, height].every((n) => Number.isFinite(n))) return null
  return { left, top, width, height }
}
