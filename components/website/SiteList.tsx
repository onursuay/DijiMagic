'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, ArrowUpRight, Globe } from 'lucide-react'
import type { Website } from '@/lib/website/types'

interface SiteListProps {
  sites: Website[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

/** Önizleme iframe'inin render genişliği (masaüstü düzeni); kart genişliğine CSS scale ile sığdırılır. */
const PREVIEW_DESIGN_WIDTH = 1280
/** Kart önizleme oranı (16/10) — masaüstü hero'su rahat sığsın. */
const PREVIEW_ASPECT = 10 / 16

/**
 * Bir sitenin canlı ANASAYFA önizlemesini, 1280px masaüstü genişliğinde render edip
 * kartın gerçek genişliğine CSS `transform: scale()` ile küçülterek gösterir.
 * iframe etkileşimsizdir (`pointer-events-none`, `aria-hidden`) ve izole edilmiştir
 * (`sandbox="allow-scripts"` — allow-same-origin YOK → opak origin, üst pencereye erişemez).
 */
function HomePreviewFrame({ siteId, label, locale }: { siteId: string; label: string; locale: string }) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.25)
  const [loaded, setLoaded] = useState(false)

  // Kartın gerçek genişliğine göre scale'i hesapla (responsive breakpoint'lerde doğru kalır).
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setScale(w / PREVIEW_DESIGN_WIDTH)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const designHeight = PREVIEW_DESIGN_WIDTH * PREVIEW_ASPECT

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden rounded-t-2xl bg-gray-50"
      style={{ aspectRatio: '16 / 10' }}
    >
      {/* Yükleniyor zemini — iframe boyanana kadar boş beyaz kart görünmesin */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <span className="inline-flex items-center gap-2 text-sm text-gray-400">
            <Globe className="w-4 h-4 animate-pulse" aria-hidden="true" />
            {t('cardPreviewLoading')}
          </span>
        </div>
      )}
      <iframe
        src={`/website-thumb/${siteId}?locale=${encodeURIComponent(locale)}`}
        title={t('cardPreviewTitle', { label })}
        aria-hidden="true"
        tabIndex={-1}
        loading="lazy"
        sandbox="allow-scripts"
        onLoad={() => setLoaded(true)}
        className="pointer-events-none origin-top-left border-0 select-none"
        style={{
          width: PREVIEW_DESIGN_WIDTH,
          height: designHeight,
          transform: `scale(${scale})`,
          // Yüklenene kadar gizle (boş iframe parlaması olmasın)
          opacity: loaded ? 1 : 0,
          transition: 'opacity 240ms ease',
        }}
      />
      {/* İnce iç çerçeve (derinlik) — tıklamayı engellemez */}
      <div
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5"
        aria-hidden="true"
      />
    </div>
  )
}

export default function SiteList({ sites, onOpen, onDelete }: SiteListProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')

  const statusLabel = (s: Website['status']) =>
    s === 'published' ? t('statusPublished') : s === 'unpublished' ? t('statusUnpublished') : t('statusDraft')

  // Sade TR durum rozeti — ham enum YOK, amber/sarı YOK.
  const statusBadgeClass = (s: Website['status']) =>
    s === 'published'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : s === 'unpublished'
        ? 'bg-red-50 text-red-700 border border-red-200'
        : 'bg-gray-100 text-gray-700 border border-gray-200'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {sites.map((site, index) => (
        <div
          key={site.id}
          className="group relative bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col animate-card-enter hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
          style={{ ['--card-index' as string]: Math.min(index, 10) }}
        >
          {/* TIKLANABİLİR ALAN — kartın kendisi siteyi açar/düzenler */}
          <button
            type="button"
            onClick={() => onOpen(site.id)}
            aria-label={t('cardOpenAria', { label: site.label })}
            className="text-left flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-2xl active:scale-[0.997] transition-transform"
          >
            <HomePreviewFrame siteId={site.id} label={site.label} locale={site.defaultLocale} />
            <div className="p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate">{site.label}</h3>
                <p className="text-sm text-gray-500 truncate mt-0.5">{site.subdomain}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`inline-flex w-fit items-center rounded-full text-caption px-2.5 py-0.5 ${statusBadgeClass(site.status)}`}
                  >
                    {statusLabel(site.status)}
                  </span>
                </div>
              </div>
              {/* "Aç / Düzenle" affordance */}
              <span className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-primary mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                {t('cardOpenEdit')}
                <ArrowUpRight
                  className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </span>
            </div>
          </button>

          {/* Sil — kart linkinin DIŞINDA (iç içe buton olmasın), sağ üstte yüzer */}
          <button
            type="button"
            onClick={() => onDelete(site.id)}
            aria-label={t('delete')}
            className="absolute top-3 right-3 z-10 rounded-lg bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-500 p-2 shadow-sm hover:text-red-600 hover:border-red-200 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 active:scale-[0.95] transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
