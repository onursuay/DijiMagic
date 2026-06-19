'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Undo2,
  Redo2,
  RefreshCw,
  Maximize2,
  Minimize2,
  Eye,
  ExternalLink,
  Globe,
  SlidersHorizontal,
} from 'lucide-react'
import DeviceSwitcher, { type Device } from './DeviceSwitcher'
import CreditBalanceIndicator from './CreditBalanceIndicator'

interface BuilderTopbarProps {
  websiteId: string
  siteLabel: string
  subdomain?: string
  /** Tuvalde gösterilen sayfanın yolu (ör. "/" veya "/about") — salt-okunur. */
  pagePath: string
  device: Device
  onDeviceChange: (d: Device) => void
  onRefresh: () => void
  fullscreen: boolean
  onToggleFullscreen: () => void
  onOpenPreview: () => void
  openingPreview: boolean
  /** Yayınlı mı → "Canlı Görüntüle" linki etkin; değilse pasif. */
  isPublished: boolean
  liveHref?: string
  onManage: () => void
  onPublish: () => void
  publishing: boolean
  /** Herhangi bir AI/yayın işlemi sürüyor → aksiyonlar kilitlenir. */
  working: boolean
}

/**
 * #builder-8a — Tam-ekran Builder Workspace üst çubuğu (Promake tarzı).
 * Geri Al / İleri Al = pasif placeholder (sürüm-geçmişi bağlama 8c). Diğer aksiyonlar bağlı:
 * cihaz seçici, sayfa yolu (salt-okunur), Yenile, Tam ekran, Önizleme (yeni sekme), Canlı,
 * Yönet, Yayınla.
 */
export default function BuilderTopbar({
  websiteId,
  siteLabel,
  subdomain,
  pagePath,
  device,
  onDeviceChange,
  onRefresh,
  fullscreen,
  onToggleFullscreen,
  onOpenPreview,
  openingPreview,
  isPublished,
  liveHref,
  onManage,
  onPublish,
  publishing,
  working,
}: BuilderTopbarProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')

  // Sade, sessiz ikon butonu (quiet chrome) — sınırsız border yerine hover'da hafifçe belirir.
  const iconBtn =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.97] transition-colors disabled:opacity-40 disabled:pointer-events-none'
  // İkincil aksiyon (Önizleme / Yönet) — ince border, sessiz.
  const ghostBtn =
    'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 h-8 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors disabled:opacity-50 active:scale-[0.97]'

  return (
    <header className="shrink-0 flex items-center gap-4 border-b border-gray-200 bg-white px-4 h-[54px]">
      {/* Sol: geri + site adı + (alt adres) */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Link
          href="/web-site-yoneticisi"
          aria-label={t('backToList')}
          title={t('backToList')}
          className={iconBtn}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-sm font-semibold text-gray-900 truncate max-w-[12rem]">{siteLabel}</span>
          {subdomain && (
            <span className="hidden md:block text-caption text-gray-400 truncate max-w-[12rem]" title={pagePath}>
              {subdomain}
            </span>
          )}
        </div>
      </div>

      {/* Orta: geri/ileri al (pasif placeholder) + cihaz seçici */}
      <div className="flex items-center gap-2 mx-auto">
        <div className="hidden sm:flex items-center gap-0.5">
          <button type="button" disabled aria-disabled title={t('builder.undoTooltip')} className={iconBtn}>
            <Undo2 className="w-4 h-4" />
          </button>
          <button type="button" disabled aria-disabled title={t('builder.redoTooltip')} className={iconBtn}>
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
        <span className="hidden sm:block h-5 w-px bg-gray-200" aria-hidden="true" />
        <DeviceSwitcher value={device} onChange={onDeviceChange} />
      </div>

      {/* Sağ: kredi pill + yenile/tam ekran + Önizleme + Yönet + Yayınla */}
      <div className="flex items-center gap-2">
        {/* #builder-8d — kredi bakiyesi pill'i (sade: spark + sayı) */}
        <CreditBalanceIndicator />

        <div className="flex items-center gap-0.5">
          <button type="button" onClick={onRefresh} title={t('builder.refresh')} aria-label={t('builder.refresh')} className={iconBtn}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={fullscreen ? t('builder.exitFullscreen') : t('builder.fullscreen')}
            aria-label={fullscreen ? t('builder.exitFullscreen') : t('builder.fullscreen')}
            aria-pressed={fullscreen}
            className={iconBtn}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        <span className="hidden sm:block h-5 w-px bg-gray-200" aria-hidden="true" />

        <button type="button" onClick={onOpenPreview} disabled={openingPreview} className={ghostBtn}>
          <Eye className="w-4 h-4" /> <span className="hidden lg:inline">{t('builder.preview')}</span>
        </button>

        {isPublished && liveHref && (
          <a
            href={liveHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 h-8 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors active:scale-[0.97]"
          >
            <ExternalLink className="w-4 h-4" /> <span className="hidden lg:inline">{t('builder.live')}</span>
          </a>
        )}

        <button type="button" onClick={onManage} className={ghostBtn}>
          <SlidersHorizontal className="w-4 h-4" /> <span className="hidden lg:inline">{t('builder.manage')}</span>
        </button>

        <button
          type="button"
          onClick={onPublish}
          disabled={working}
          data-website-id={websiteId}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 h-8 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 active:scale-[0.97] transition-all disabled:opacity-50"
        >
          <Globe className="w-4 h-4" />
          {publishing ? t('publishing') : isPublished ? t('builder.managePublish') : t('builder.publish')}
        </button>
      </div>
    </header>
  )
}
