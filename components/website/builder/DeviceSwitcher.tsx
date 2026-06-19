'use client'

import { Monitor, Tablet, Smartphone } from 'lucide-react'
import { useTranslations } from 'next-intl'

export type Device = 'desktop' | 'tablet' | 'mobile'

/** Cihaz başına TASARIM genişliği (gerçek viewport ölçeği) — onizleme/detay ile aynı değerler. */
export const DESIGN_W: Record<Device, number> = { desktop: 1280, tablet: 834, mobile: 390 }

interface DeviceSwitcherProps {
  value: Device
  onChange: (device: Device) => void
}

/**
 * #builder-8a — Masaüstü / Tablet / Mobil seçici (Promake tarzı topbar segment'i).
 * Cihaz genişlikleri DESIGN_W'den gelir; PreviewCanvas bu genişliğe göre ölçeklenir.
 */
export default function DeviceSwitcher({ value, onChange }: DeviceSwitcherProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')

  const btn = (d: Device, Icon: typeof Monitor, label: string) => (
    <button
      type="button"
      onClick={() => onChange(d)}
      aria-label={label}
      aria-pressed={value === d}
      title={label}
      className={`rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
        value === d ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-700'
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  )

  return (
    <div
      role="group"
      aria-label={t('builder.deviceLabel')}
      className="inline-flex items-center rounded-lg border border-gray-200 p-0.5 bg-white"
    >
      {btn('desktop', Monitor, t('deviceDesktop'))}
      {btn('tablet', Tablet, t('deviceTablet'))}
      {btn('mobile', Smartphone, t('deviceMobile'))}
    </div>
  )
}
