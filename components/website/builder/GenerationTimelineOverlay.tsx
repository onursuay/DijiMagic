'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Layers, FileText, LayoutGrid, ImageIcon, Languages, Sparkles, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** #builder-5b telemetri olayı (credit-events route yanıt şekli). */
interface CreditEvent {
  id: string
  versionId: string | null
  phase: string
  creditDelta: number
  status: 'charged' | 'refunded'
  createdAt: string
}

interface GenerationTimelineOverlayProps {
  websiteId: string
  /** Üretim/revizyon sürerken TRUE → overlay görünür ve canlı yoklar; bitince kaybolur. */
  active: boolean
  reloadKey?: number
}

const PHASE_META: Record<string, { icon: LucideIcon; key: string }> = {
  designSystem: { icon: Layers, key: 'phaseDesignSystem' },
  blueprint: { icon: FileText, key: 'phaseBlueprint' },
  render: { icon: LayoutGrid, key: 'phaseRender' },
  images: { icon: ImageIcon, key: 'phaseImages' },
  translate: { icon: Languages, key: 'phaseTranslate' },
  publish: { icon: Sparkles, key: 'phasePublish' },
  custom_component: { icon: Sparkles, key: 'phaseCustom' },
}
const PHASE_ORDER = ['designSystem', 'blueprint', 'render', 'images', 'translate', 'publish', 'custom_component']

/**
 * #builder-8d — GEÇİCİ üretim zaman çizelgesi. Eski kalıcı sol-rail "Kredi kullanımı" paneli
 * KALDIRILDI; bunun yerine yalnız aktif üretim/revizyon sürerken tuvalin ÜSTÜNDE merkeze gelen
 * zarif bir overlay olarak çıkar ("Tasarım sistemi · İçerik · Sayfalar · Görseller…") ve iş
 * bitince kaybolur. Detaylı kredi geçmişi Yönet drawer'ında yaşar; kalıcı kredi bilgisi topbar
 * pill'inde. Faz etiketleri sade TR/EN (ham enum YASAK), amber/sarı YOK. Veri yoksa "hesaplanıyor".
 */
export default function GenerationTimelineOverlay({ websiteId, active, reloadKey = 0 }: GenerationTimelineOverlayProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi.builder.credit')
  const [events, setEvents] = useState<CreditEvent[] | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!websiteId) return
    try {
      const res = await fetch(`/api/website/${websiteId}/credit-events`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (json?.ok && Array.isArray(json.events)) setEvents(json.events as CreditEvent[])
    } catch {
      /* fail-soft — overlay "hesaplanıyor" satırını gösterir */
    }
  }, [websiteId])

  // Üretim sürerken 2sn'de bir yokla; bitince durdur.
  useEffect(() => {
    if (!active) {
      if (timer.current) { clearInterval(timer.current); timer.current = null }
      return
    }
    void fetchEvents()
    timer.current = setInterval(() => { void fetchEvents() }, 2000)
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null } }
  }, [active, fetchEvents])

  useEffect(() => { if (active) void fetchEvents() }, [reloadKey, active, fetchEvents])

  if (!active) return null

  const latest = groupLatest(events ?? [])
  const total = latest.reduce((acc, e) => acc + e.creditDelta, 0)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-gray-200/80 bg-white/95 backdrop-blur-md p-4 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.30),0_2px_8px_-2px_rgba(15,23,42,0.08)] wsy-timeline-pop">
        <div className="flex items-center gap-2 pb-3">
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          <h3 className="text-base font-semibold text-gray-900">{t('timelineTitle')}</h3>
          {total > 0 && (
            <span className="ml-auto inline-flex items-center rounded-full bg-primary/5 text-primary text-caption font-medium px-2 py-0.5 tabular-nums">
              −{total}
            </span>
          )}
        </div>

        {latest.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin shrink-0" />
            <span className="text-sm text-gray-600">{t('timelineCalculating')}</span>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {latest.map((e, i) => {
              const meta = PHASE_META[e.phase]
              const Icon = meta?.icon ?? Sparkles
              const label = meta ? t(meta.key) : e.phase
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors animate-card-enter"
                  style={{ ['--card-index' as string]: Math.min(i, 10) }}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-sm text-gray-700 truncate">{label}</span>
                  <span
                    className={`ml-auto text-sm font-medium tabular-nums ${
                      e.status === 'refunded' || e.creditDelta < 0 ? 'text-emerald-700' : 'text-gray-900'
                    }`}
                  >
                    {e.creditDelta < 0 ? `+${Math.abs(e.creditDelta)}` : e.creditDelta === 0 ? t('free') : `−${e.creditDelta}`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/** En son üretimin olaylarını seç + faz sırasına göre sırala (CreditUsageTimeline ile aynı mantık). */
function groupLatest(events: CreditEvent[]): CreditEvent[] {
  if (events.length === 0) return []
  const head = events[0]
  const sameGroup = head.versionId
    ? events.filter((e) => e.versionId === head.versionId)
    : events.filter((e) => e.createdAt.slice(0, 19) === head.createdAt.slice(0, 19))
  return sameGroup
    .slice()
    .sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase))
}
