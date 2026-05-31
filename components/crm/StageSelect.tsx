'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { STAGES, STAGE_STYLE, type Stage } from './stageMeta'

/**
 * Lead aşaması seçici — Meta tarzı dropdown (ham <select> YASAK). Dış tıklama
 * kapatır; seçili aşama renkli chip olarak görünür.
 */
export default function StageSelect({
  value,
  onChange,
  labelFor,
}: {
  value: Stage
  onChange: (s: Stage) => void
  labelFor: (s: Stage) => string
}) {
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

  const style = STAGE_STYLE[value]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-xs font-medium border ${style.chip} hover:brightness-95 transition`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {labelFor(value)}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white rounded-xl border border-gray-200 shadow-lg py-1">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setOpen(false)
                if (s !== value) onChange(s)
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${s === value ? 'text-primary font-medium' : 'text-gray-700'}`}
            >
              <span className={`w-2 h-2 rounded-full ${STAGE_STYLE[s].dot}`} />
              <span className="flex-1">{labelFor(s)}</span>
              {s === value && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
