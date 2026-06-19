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
  Settings,
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

  const iconBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50/60 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none'

  return (
    <header className="shrink-0 flex items-center gap-3 border-b border-gray-200 bg-white px-4 h-14">
      {/* Sol: geri + site adı */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Link
          href="/web-site-yoneticisi"
          aria-label={t('backToList')}
          title={t('backToList')}
          className={iconBtn}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm font-semibold text-gray-900 truncate max-w-[12rem]">{siteLabel}</span>
      </div>

      {/* Geri Al / İleri Al — pasif placeholder (8c) */}
      <div className="hidden sm:flex items-center gap-1.5 pl-1">
        <button type="button" disabled aria-disabled title={t('builder.undoTooltip')} className={iconBtn}>
          <Undo2 className="w-4 h-4" />
        </button>
        <button type="button" disabled aria-disabled title={t('builder.redoTooltip')} className={iconBtn}>
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Orta: cihaz seçici + sayfa yolu */}
      <div className="flex items-center gap-3 mx-auto min-w-0">
        <DeviceSwitcher value={device} onChange={onDeviceChange} />
        <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50/60 px-3 h-9 min-w-0">
          <span className="text-caption text-gray-400 shrink-0">{subdomain ?? '—'}</span>
          <span className="text-sm text-gray-700 font-medium truncate" title={pagePath}>{pagePath}</span>
        </div>
      </div>

      {/* Sağ: aksiyonlar */}
      <div className="flex items-center gap-1.5">
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

        <span className="mx-1 hidden sm:block h-6 w-px bg-gray-200" aria-hidden="true" />

        {/* #builder-8c — kredi bakiyesi (useCredits) */}
        <CreditBalanceIndicator />

        <button
          type="button"
          onClick={onOpenPreview}
          disabled={openingPreview}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 h-9 text-sm font-medium text-gray-700 hover:shadow-md transition-all duration-300 disabled:opacity-50 active:scale-[0.97]"
        >
          <Eye className="w-4 h-4" /> <span className="hidden lg:inline">{t('builder.preview')}</span>
        </button>

        {isPublished && liveHref ? (
          <a
            href={liveHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 h-9 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors active:scale-[0.97]"
          >
            <ExternalLink className="w-4 h-4" /> <span className="hidden lg:inline">{t('builder.live')}</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled
            title={t('statusDraft')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 h-9 text-sm font-medium text-gray-400 opacity-60 pointer-events-none"
          >
            <Globe className="w-4 h-4" /> <span className="hidden lg:inline">{t('builder.live')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onManage}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 h-9 text-sm font-medium text-gray-700 hover:shadow-md transition-all duration-300 active:scale-[0.97]"
        >
          <Settings className="w-4 h-4" /> <span className="hidden lg:inline">{t('builder.manage')}</span>
        </button>

        <button
          type="button"
          onClick={onPublish}
          disabled={working}
          data-website-id={websiteId}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 h-9 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[0.97] transition-all disabled:opacity-50"
        >
          <Globe className="w-4 h-4" />
          {publishing ? t('publishing') : isPublished ? t('builder.managePublish') : t('builder.publish')}
        </button>
      </div>
    </header>
  )
}
