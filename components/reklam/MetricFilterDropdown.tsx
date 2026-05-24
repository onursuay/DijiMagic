'use client'

/* Reklam Yöneticisi — Metrik Görünürlük Filtresi (Meta + Google ortak).
   Kullanıcı tabloda hangi metrik sütunlarını görmek istediğini seçer.
   - Dış tıklama → kapanır (proje picker standardı)
   - En az 1 metrik açık kalır
   - Renk: yalnız primary/emerald/gray (amber/sarı YASAK) */

import { useState, useRef, useEffect } from 'react'
import { SlidersHorizontal, Check } from 'lucide-react'

export interface MetricOption {
  key: string
  label: string
}

interface MetricFilterDropdownProps {
  metrics: MetricOption[]
  visible: Set<string>
  onChange: (next: Set<string>) => void
  labels: { button: string; title: string; all: string }
}

export default function MetricFilterDropdown({ metrics, visible, onChange, labels }: MetricFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const visibleCount = metrics.filter((m) => visible.has(m.key)).length

  const toggle = (key: string) => {
    const next = new Set(visible)
    if (next.has(key)) {
      if (visibleCount <= 1) return // en az 1 metrik görünür kalsın
      next.delete(key)
    } else {
      next.add(key)
    }
    onChange(next)
  }

  const allOn = metrics.every((m) => visible.has(m.key))
  const toggleAll = () => {
    onChange(allOn ? new Set(metrics.slice(0, 1).map((m) => m.key)) : new Set(metrics.map((m) => m.key)))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
          open ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {labels.button}
        <span className="text-xs text-gray-400">({visibleCount})</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1.5 max-h-80 overflow-y-auto">
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-100 mb-1">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{labels.title}</span>
            <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
              {labels.all}
            </button>
          </div>
          {metrics.map((m) => {
            const on = visible.has(m.key)
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => toggle(m.key)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-emerald-50 transition-colors text-left"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    on ? 'bg-primary border-primary' : 'border-gray-300'
                  }`}
                >
                  {on && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="truncate">{m.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
