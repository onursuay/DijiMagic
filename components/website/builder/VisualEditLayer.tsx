'use client'

import SelectedElementToolbar from './SelectedElementToolbar'
import type { VisualEditOp, VisualSelection } from './visualEditTypes'

interface VisualEditLayerProps {
  selection: VisualSelection | null
  /** Device scale applied to the iframe (PreviewCanvas transform). */
  scale: number
  /** The iframe's visual top-left within the canvas AREA (after centering + scale). */
  iframeLeft: number
  iframeTop: number
  busy: VisualEditOp | null
  canMoveUp: boolean
  canMoveDown: boolean
  onEditContent: () => void
  onAiRewrite: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

/**
 * #builder-8b — the parent-side overlay for the visual-edit select layer. It draws a
 * highlight box over the SELECTED block + hosts the inline SelectedElementToolbar.
 *
 * The selection rect arrives via postMessage in the IFRAME's own coordinate space
 * (the iframe stays sandboxed `allow-scripts`, no same-origin — no parent DOM access).
 * Here we map it into the canvas AREA's coordinate space by the device scale + the
 * iframe's centered offset, so the box lines up with the on-canvas block.
 *
 * The overlay itself is pointer-events:none (clicks pass through to the iframe so the
 * in-iframe runtime keeps handling hover/select); only the toolbar buttons capture.
 */
export default function VisualEditLayer({
  selection,
  scale,
  iframeLeft,
  iframeTop,
  busy,
  canMoveUp,
  canMoveDown,
  onEditContent,
  onAiRewrite,
  onDelete,
  onMoveUp,
  onMoveDown,
}: VisualEditLayerProps) {
  if (!selection) return null

  const { rect } = selection
  const boxLeft = iframeLeft + rect.left * scale
  const boxTop = iframeTop + rect.top * scale
  const boxW = rect.width * scale
  const boxH = rect.height * scale

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden={false}>
      {/* Highlight box around the selected block. */}
      <div
        className="absolute rounded-md ring-2 ring-primary"
        style={{
          left: boxLeft,
          top: boxTop,
          width: boxW,
          height: boxH,
          boxShadow: '0 0 0 4px rgba(5,150,105,0.10)',
        }}
      />
      <SelectedElementToolbar
        x={boxLeft}
        y={boxTop}
        busy={busy}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onEditContent={onEditContent}
        onAiRewrite={onAiRewrite}
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    </div>
  )
}
