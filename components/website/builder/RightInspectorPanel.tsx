'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal, MousePointerClick, Sparkles, Trash2, X, Check, Loader2 } from 'lucide-react'
import { COMPONENTS, type ContentField } from '@/lib/website/codegen/library'
import type { VisualEditOp, VisualSelection } from './visualEditTypes'

interface RightInspectorPanelProps {
  /** #builder-8b — null → "Yakında/seç" boş durumu; doluysa contentFields editörü. */
  selection?: VisualSelection | null
  busy?: VisualEditOp | null
  /** Inspector alan değerlerini PATCH'e gönder (op='edit'). */
  onApply?: (content: Record<string, string>) => void
  /** Serbest AI komutuyla bloğu yeniden yaz (op='ai_rewrite'). */
  onAiRewrite?: (instruction: string) => void
  /** Bloğu sil (op='delete'). */
  onDelete?: () => void
  /** Seçimi temizle. */
  onClear?: () => void
}

/**
 * #builder-8b — SAĞ müfettiş (inspector). Tuvalde tıkla-seç ile blok seçilince, o bloğun
 * ComponentDef.contentFields (library registry) sözleşmesine göre düzenlenebilir alanlar
 * (text / richtext / image / href / list) üretir. "Uygula" → cerrahi PATCH (full regen YASAK;
 * applyBlockPatch yeniden kullanılır). Ayrıca AI ile yeniden yaz + sil aksiyonları.
 *
 * Not: mevcut library blokları metni data-yoai-field ile İŞARETLEMEZ; bu yüzden alanların
 * MEVCUT değeri DOM'dan okunamaz (iframe sandbox'lı). Alanlar, kullanıcının YENİ değeri
 * girmesi için boş başlar; girilen alanlar talimata çevrilip yalnız o metinleri günceller
 * (boş alanlar dokunulmadan korunur). Bu, izolasyonu bozmadan hedefli düzenleme sağlar.
 */
export default function RightInspectorPanel({
  selection = null,
  busy = null,
  onApply,
  onAiRewrite,
  onDelete,
  onClear,
}: RightInspectorPanelProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const tv = useTranslations('dashboard.webSiteYoneticisi.builder.visualEdit')

  const def = selection?.blockKey ? COMPONENTS[selection.blockKey] : undefined
  // Only INSPECTOR-editable text-like fields (skip image queries / lists for the MVP
  // text editor — they still flow through AI rewrite). editable:false fields are hidden.
  const fields: ContentField[] = useMemo(() => {
    if (!def) return []
    return def.contentFields.filter(
      (f) => f.editable !== false && (f.type === 'text' || f.type === 'richtext' || f.type === 'href'),
    )
  }, [def])

  const [values, setValues] = useState<Record<string, string>>({})
  const [aiText, setAiText] = useState('')

  // Reset the form when the selected block changes (fields start empty — see note above).
  useEffect(() => {
    setValues({})
    setAiText('')
  }, [selection?.blockId])

  const working = busy !== null

  // ── Empty state — nothing selected yet ────────────────────────────────────────
  if (!selection) {
    return (
      <div className="flex flex-1 min-h-0 flex-col">
        <div className="flex items-center gap-2 px-1 pb-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SlidersHorizontal className="w-4 h-4" />
          </span>
          <h3 className="text-base font-semibold text-gray-900">{t('builder.inspectorTitle')}</h3>
        </div>
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-5 py-8">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-gray-200 text-primary">
            <MousePointerClick className="w-5 h-5" />
          </span>
          <p className="mt-3 text-sm leading-relaxed text-gray-500 max-w-[16rem]">{t('builder.inspectorHint')}</p>
        </div>
      </div>
    )
  }

  const blockLabel = def ? blockKeyLabel(def.category, tv) : tv('unknownBlock')
  const hasInput = Object.values(values).some((v) => v.trim().length > 0)

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex items-center gap-2 px-1 pb-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SlidersHorizontal className="w-4 h-4" />
        </span>
        <h3 className="text-base font-semibold text-gray-900">{t('builder.inspectorTitle')}</h3>
        <button
          type="button"
          onClick={() => onClear?.()}
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label={tv('clearSelection')}
          title={tv('clearSelection')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 flex flex-col gap-4">
        {/* Selected block summary */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-3 animate-card-enter">
          <p className="text-caption uppercase tracking-wide text-gray-400">{tv('selectedBlock')}</p>
          <p className="mt-0.5 text-sm font-medium text-gray-800">{blockLabel}</p>
          {selection.text ? (
            <p className="mt-1 text-sm leading-relaxed text-gray-500 line-clamp-2">{selection.text}</p>
          ) : null}
        </div>

        {/* contentFields editor (text/href) */}
        {fields.length > 0 ? (
          <div className="flex flex-col gap-3 animate-card-enter" style={{ ['--card-index' as string]: 1 }}>
            <p className="text-base font-medium text-gray-700">{tv('editFieldsTitle')}</p>
            {fields.map((f) => (
              <label key={f.name} className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">{f.label}</span>
                {f.type === 'richtext' ? (
                  <textarea
                    value={values[f.name] ?? ''}
                    onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                    rows={3}
                    placeholder={tv('fieldPlaceholder')}
                    disabled={working}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-60"
                  />
                ) : (
                  <input
                    type="text"
                    value={values[f.name] ?? ''}
                    onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                    placeholder={tv('fieldPlaceholder')}
                    disabled={working}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-60"
                  />
                )}
              </label>
            ))}
            <button
              type="button"
              onClick={() => onApply?.(values)}
              disabled={working || !hasInput}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {busy === 'edit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {tv('apply')}
            </button>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-gray-500">{tv('noEditableFields')}</p>
        )}

        {/* AI rewrite */}
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 animate-card-enter" style={{ ['--card-index' as string]: 2 }}>
          <p className="text-base font-medium text-gray-700">{tv('aiRewriteTitle')}</p>
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            rows={2}
            placeholder={tv('aiRewritePlaceholder')}
            disabled={working}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => onAiRewrite?.(aiText.trim())}
            disabled={working}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {busy === 'ai_rewrite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {tv('aiRewrite')}
          </button>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete?.()}
          disabled={working}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 active:scale-[0.97] transition-all disabled:opacity-50 animate-card-enter"
          style={{ ['--card-index' as string]: 3 }}
        >
          {busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {tv('delete')}
        </button>
      </div>
    </div>
  )
}

/** Coarse, user-friendly TR/EN label for a block, by its component category. */
function blockKeyLabel(category: string, tv: (k: string) => string): string {
  const key = `category.${category}`
  const label = tv(key)
  // next-intl returns the key path when missing → fall back to the raw category.
  return label.startsWith('category.') ? category : label
}
