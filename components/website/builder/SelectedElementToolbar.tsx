'use client'

import { useTranslations } from 'next-intl'
import { Pencil, Sparkles, Trash2, ArrowUp, ArrowDown, Loader2 } from 'lucide-react'
import type { VisualEditOp } from './visualEditTypes'

interface SelectedElementToolbarProps {
  /** Pixel position (relative to the canvas area) for the toolbar (top-left of selection). */
  x: number
  y: number
  /** Whether a patch is in-flight (disables actions + shows a spinner on the busy op). */
  busy: VisualEditOp | null
  /** Focus the right inspector (edit content). */
  onEditContent: () => void
  onAiRewrite: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  /** Disable move buttons at the list boundaries. */
  canMoveUp: boolean
  canMoveDown: boolean
}

/**
 * #builder-8b — inline floating toolbar pinned to the selected block. Quick actions:
 * edit content (focus inspector), AI rewrite, move up/down, delete. The actual edit
 * happens through the right inspector / a targeted PATCH (full regen YASAK).
 *
 * Anchored above the selection (or below if it would clip the top). Pointer-events
 * are on the buttons only so the rest of the overlay stays click-through to the iframe.
 */
export default function SelectedElementToolbar({
  x,
  y,
  busy,
  onEditContent,
  onAiRewrite,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: SelectedElementToolbarProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi.builder.visualEdit')

  const btn =
    'inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-600 hover:text-primary hover:bg-primary/5 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.94] transition-all ' +
    'disabled:opacity-40 disabled:pointer-events-none'

  const working = busy !== null

  return (
    <div
      className="absolute z-30 flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white p-1 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.35)]"
      style={{ left: Math.max(0, x), top: Math.max(0, y - 46), pointerEvents: 'auto' }}
      role="toolbar"
      aria-label={t('toolbarLabel')}
    >
      <button type="button" className={btn} onClick={onEditContent} disabled={working} title={t('editContent')} aria-label={t('editContent')}>
        <Pencil className="w-4 h-4" />
      </button>
      <button type="button" className={btn} onClick={onAiRewrite} disabled={working} title={t('aiRewrite')} aria-label={t('aiRewrite')}>
        {busy === 'ai_rewrite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      </button>
      <span className="mx-0.5 h-5 w-px bg-gray-200" aria-hidden="true" />
      <button type="button" className={btn} onClick={onMoveUp} disabled={working || !canMoveUp} title={t('moveUp')} aria-label={t('moveUp')}>
        {busy === 'move' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
      </button>
      <button type="button" className={btn} onClick={onMoveDown} disabled={working || !canMoveDown} title={t('moveDown')} aria-label={t('moveDown')}>
        <ArrowDown className="w-4 h-4" />
      </button>
      <span className="mx-0.5 h-5 w-px bg-gray-200" aria-hidden="true" />
      <button
        type="button"
        className={btn + ' hover:text-red-600 hover:bg-red-50'}
        onClick={onDelete}
        disabled={working}
        title={t('delete')}
        aria-label={t('delete')}
      >
        {busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
    </div>
  )
}
