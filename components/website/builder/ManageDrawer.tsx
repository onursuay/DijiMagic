'use client'

import { useTranslations } from 'next-intl'
import { X, Palette, ImagePlus, RefreshCw, Settings } from 'lucide-react'
import DomainPanel from '@/components/website/DomainPanel'
import VersionHistoryPanel from './VersionHistoryPanel'
import type { WebsiteVersionMeta } from '@/lib/website/types'

interface ManageDrawerProps {
  websiteId: string
  open: boolean
  onClose: () => void
  onOpenDesign: () => void
  onLogoClick: () => void
  logoBusy: boolean
  versions: WebsiteVersionMeta[]
  onRollback: (versionId: string) => void
  rollbackBusy: boolean
  working: boolean
}

/**
 * #builder-8a — "Yönet" sağ-drawer'ı. Mevcut işlevleri (Tasarım paneli, Logo değiştir, kendi alan
 * adı, sürüm geçmişi / geri al) tek noktadan ERİŞİLEBİLİR tutar — eski detay sayfasındaki kartlar
 * burada konsolide edildi (işlevsellik kaybı yok). 8c'de sürüm-geçmişi/yayın-popup buradan ayrılıp
 * kendi bileşenlerine taşınabilir; şimdilik mevcut çalışan akışlar korunur.
 */
export default function ManageDrawer({
  websiteId,
  open,
  onClose,
  onOpenDesign,
  onLogoClick,
  logoBusy,
  versions,
  onRollback,
  rollbackBusy,
  working,
}: ManageDrawerProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={t('builder.manageTitle')}>
      <button type="button" aria-label={t('cancel')} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto animate-[wsy-drawer-in_.25s_ease]">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-5 h-14">
          <Settings className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-gray-900">{t('builder.manageTitle')}</h2>
          <button type="button" onClick={onClose} aria-label={t('cancel')} className="ml-auto text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-sm leading-relaxed text-gray-600">{t('builder.manageHint')}</p>

          {/* Tasarım + Logo */}
          <div className="space-y-2">
            <h3 className="text-base font-medium text-gray-700">{t('builder.designSettings')}</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenDesign}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors"
              >
                <Palette className="w-4 h-4" /> {t('designTitle')}
              </button>
              <button
                type="button"
                onClick={onLogoClick}
                disabled={working}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50"
              >
                {logoBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} {t('logoChange')}
              </button>
            </div>
          </div>

          {/* Kendi alan adı */}
          <DomainPanel websiteId={websiteId} />

          {/* Sürüm geçmişi / geri al (#builder-8c — onaylı geri-al) */}
          <VersionHistoryPanel
            versions={versions}
            rollbackBusy={rollbackBusy}
            working={working}
            onRollback={onRollback}
          />
        </div>
      </div>
    </div>
  )
}
