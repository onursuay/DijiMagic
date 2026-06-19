'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Layers, FileText, LayoutGrid, ImageIcon, Languages, Sparkles, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** #builder-5b telemetri olayı (yanıt şekli credit-events route'undan). */
interface CreditEvent {
  id: string
  versionId: string | null
  phase: string
  creditDelta: number
  status: 'charged' | 'refunded'
  createdAt: string
}

interface CreditUsageTimelineProps {
  websiteId: string
  /** Bir üretim/revizyon sürerken poll'u sıklaştırmak + canlı durum göstermek için. */
  active?: boolean
  /** Üretim bitince/parent değiştiğinde yeniden çekmeyi tetikler. */
  reloadKey?: number
}

/** Sade TR/EN faz etiketleri (ham enum YASAK) + her faza özel ikon. */
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
 * #builder-8c — Kredi kullanım zaman çizelgesi. `GET /credit-events`'i yoklar ve EN SON
 * üretimin/revizyonun faz-faz kredi kırılımını gösterir
 * ("Tasarım sistemi −20 · İçerik planı −30 · Sayfalar −80 · Görseller −50").
 *
 * Olaylar TELEMETRİdir (tek gerçek charge'ın display kırılımı) — burada kredi DÜŞMEZ.
 * Faz etiketleri sade TR/EN (ham enum yok). Amber/sarı YOK. Üretim sürerken (active)
 * 2sn'de bir, aksi halde tek sefer + reloadKey değişince çekilir. Migration uygulanmamışsa
 * route fail-soft [] döner → timeline boş durumla sessizce kalır.
 */
export default function CreditUsageTimeline({ websiteId, active = false, reloadKey = 0 }: CreditUsageTimelineProps) {
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
      /* fail-soft — timeline boş kalır */
    }
  }, [websiteId])

  // Tek sefer + reloadKey değişince çek.
  useEffect(() => { void fetchEvents() }, [fetchEvents, reloadKey])

  // Üretim sürerken (active) 2sn'de bir yokla; bitince durdur.
  useEffect(() => {
    if (!active) {
      if (timer.current) { clearInterval(timer.current); timer.current = null }
      return
    }
    void fetchEvents()
    timer.current = setInterval(() => { void fetchEvents() }, 2000)
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null } }
  }, [active, fetchEvents])

  // EN SON sürümün (versionId) faz kırılımını al — yoksa en yeni olay grubunu kullan.
  const latest = groupLatest(events ?? [])

  // Üretim sürerken kayıt henüz yoksa "hesaplanıyor" satırı göster.
  const showPending = active && latest.length === 0

  if (!active && latest.length === 0) {
    // İlk üretimden önce / olay yokken paneli yer kaplatma (sessiz boş durum).
    return null
  }

  const total = latest.reduce((acc, e) => acc + e.creditDelta, 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5 animate-card-enter">
      <div className="flex items-center gap-2 pb-2.5">
        {active ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary" />
        )}
        <h3 className="text-base font-semibold text-gray-900">{t('timelineTitle')}</h3>
        {!active && total > 0 && (
          <span className="ml-auto inline-flex items-center rounded-full bg-primary/5 text-primary text-caption font-medium px-2 py-0.5 tabular-nums">
            −{total}
          </span>
        )}
      </div>

      {showPending ? (
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
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50/60 transition-colors animate-card-enter"
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
  )
}

/**
 * En son üretimin/revizyonun olaylarını seç + faz sırasına göre sırala. Olaylar
 * route'tan "en yeni önce" gelir; ilk olayın versionId'sini taşıyan tüm satırları
 * (aynı tek-charge'ın fazları) alır. versionId yoksa en yeni `createdAt` saniyesine
 * düşer (toplu üretimde fazlar saniye-aynıdır).
 */
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
