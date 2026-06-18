'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, ArrowUpRight, Globe, ChevronDown } from 'lucide-react'
import type { Website } from '@/lib/website/types'

interface SiteListProps {
  sites: Website[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

/** Önizleme iframe'inin render genişliği (masaüstü düzeni); panel genişliğine CSS scale ile sığdırılır. */
const PREVIEW_DESIGN_WIDTH = 1280

/**
 * Bir sitenin canlı ANASAYFA önizlemesini, 1280px masaüstü genişliğinde render edip
 * panelin gerçek genişliğine CSS `transform: scale()` ile büyütüp/küçülterek gösterir.
 * iframe etkileşimsizdir (`pointer-events-none`, `aria-hidden`) ve izole edilmiştir
 * (`sandbox="allow-scripts"` — allow-same-origin YOK → opak origin, üst pencereye erişemez).
 */
function HomePreviewFrame({ siteId, label, locale }: { siteId: string; label: string; locale: string }) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const [loaded, setLoaded] = useState(false)

  // Panelin gerçek genişliğine göre scale'i hesapla (responsive breakpoint'lerde doğru kalır).
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

  // iframe yüksekliği: tasarım genişliğini scale'e bölünmüş panel yüksekliğine eşleştir,
  // ki ölçeklendikten sonra panelin tamamını doldursun (büyük "tam ekran" önizleme).
  const designHeight = PREVIEW_DESIGN_WIDTH

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden bg-gray-50">
      {/* Yükleniyor zemini — iframe boyanana kadar boş beyaz panel görünmesin */}
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

  const multiple = sites.length > 1

  return (
    /**
     * Tam-ekran dikey kaydırmalı galeri (scroll-snap deck): her site = TEK büyük panel,
     * panel yüksekliği yaklaşık görünür alan kadar (`min-h-[78vh]`) → kaydırınca tek tek
     * site geçilir ("sayfa kaydırır gibi"). `snap-y snap-mandatory` kaydırma kabı
     * sayfanın `app-content-surface` kabıdır; burada her panele `snap-start` verilir.
     */
    <div className="space-y-6">
      {sites.map((site, index) => (
        <section
          key={site.id}
          className="snap-start scroll-mt-2"
          aria-label={t('cardPreviewTitle', { label: site.label })}
        >
          <div
            className="group relative bg-white rounded-3xl border border-gray-200 overflow-hidden flex flex-col animate-card-enter hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-300 min-h-[78vh]"
            style={{ ['--card-index' as string]: Math.min(index, 10) }}
          >
            {/* TIKLANABİLİR BÜYÜK ÖNİZLEME — panelin kendisi siteyi açar/düzenler */}
            <button
              type="button"
              onClick={() => onOpen(site.id)}
              aria-label={t('cardOpenAria', { label: site.label })}
              className="relative flex-1 min-h-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset active:opacity-[0.97] transition-opacity"
            >
              <HomePreviewFrame siteId={site.id} label={site.label} locale={site.defaultLocale} />
              {/* Alt degrade — başlık/rozet okunaklı kalsın */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 via-black/15 to-transparent"
                aria-hidden="true"
              />
              {/* Site bilgisi (panel üzerine yüzer) */}
              <div className="absolute inset-x-0 bottom-0 p-6 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2">
                    <span
                      className={`inline-flex w-fit items-center rounded-full text-caption px-2.5 py-0.5 ${statusBadgeClass(site.status)}`}
                    >
                      {statusLabel(site.status)}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight text-white truncate drop-shadow-sm">{site.label}</h3>
                  <p className="text-sm text-white/80 truncate mt-0.5">{site.subdomain}</p>
                </div>
                {/* "Aç / Düzenle" affordance */}
                <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-primary shadow-lg shadow-black/10 group-hover:bg-white transition-colors">
                  {t('cardOpenEdit')}
                  <ArrowUpRight
                    className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </button>

            {/* Sil — panel linkinin DIŞINDA (iç içe buton olmasın), sağ üstte yüzer */}
            <button
              type="button"
              onClick={() => onDelete(site.id)}
              aria-label={t('delete')}
              className="absolute top-4 right-4 z-10 rounded-xl bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-500 p-2.5 shadow-sm hover:text-red-600 hover:border-red-200 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 active:scale-[0.95] transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Kaydırma ipucu — birden fazla site varken, son panel hariç */}
            {multiple && index < sites.length - 1 && (
              <div
                className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur-sm px-3 py-1 text-caption font-medium text-white/90"
                aria-hidden="true"
              >
                <span>{t('siteCounter', { current: index + 1, total: sites.length })}</span>
                <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
