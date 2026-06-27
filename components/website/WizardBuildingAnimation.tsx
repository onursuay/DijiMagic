'use client'

/* ──────────────────────────────────────────────────────────
   Web Site Yöneticisi — "AI siteni kuruyor" yükleme animasyonu.
   Emerald (DijiMagic marka) bir mini-tarayıcı içinde sayfanın blokları
   sırayla belirir (assemble + shimmer); tepeden inen "AI tarama ışığı"
   ve arkada nabız gibi parlama AI üretimini andırır. Altta gerçek
   üretim aşamaları (tasarım sistemi → sayfalar → son rötuş) döner.
   Tüm hareket transform/opacity; prefers-reduced-motion'da sakinleşir.
   Renkler yalnız primary(emerald)/gray — amber/sarı YOK.
   ────────────────────────────────────────────────────────── */

import { useTranslations } from 'next-intl'

const STAGE_KEYS = ['stageDesignSystem', 'stageBuildingPage', 'stagePolishing'] as const

interface WizardBuildingAnimationProps {
  /** 0 = design system, 1 = building page, 2 = polishing/final (default: 0) */
  stage?: 0 | 1 | 2
  /** 0–100 progress percentage; if provided renders a determinate progress bar */
  progress?: number
  /** Latest log line from the job; displayed below the stage label */
  lastLog?: string
}

export default function WizardBuildingAnimation({
  stage = 0,
  progress,
  lastLog,
}: WizardBuildingAnimationProps = {}) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const tc = useTranslations('website.building')
  const stages = STAGE_KEYS.map((k) => tc(k))

  return (
    <div className="wsy-build relative flex flex-col items-center text-center py-10 px-4 overflow-hidden">
      {/* atmosferik nabız parlaması */}
      <div className="wsy-glow pointer-events-none absolute -top-12 left-1/2 h-[440px] w-[440px] rounded-full" aria-hidden />

      {/* kurulan site — mini tarayıcı */}
      <div
        className="wsy-canvas relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_28px_64px_-28px_rgba(43,182,115,0.45)]"
        aria-hidden
      >
        {/* tarayıcı çubuğu */}
        <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/70 px-3 h-8">
          <span className="h-2 w-2 rounded-full bg-gray-200" />
          <span className="h-2 w-2 rounded-full bg-gray-200" />
          <span className="h-2 w-2 rounded-full bg-gray-200" />
          <span className="ml-2 h-3 max-w-[52%] flex-1 rounded-full bg-gray-100" />
        </div>

        {/* sayfa blokları (sırayla beliriyor) */}
        <div className="relative space-y-3 p-3.5">
          <div className="wsy-block wsy-shimmer h-3.5 w-1/3 rounded" style={{ ['--i' as string]: 0 }} />
          <div className="wsy-block wsy-shimmer h-16 w-full rounded-lg" style={{ ['--i' as string]: 1 }} />
          <div className="wsy-block wsy-shimmer h-2.5 w-3/4 rounded" style={{ ['--i' as string]: 2 }} />
          <div className="wsy-block wsy-shimmer h-2.5 w-2/3 rounded" style={{ ['--i' as string]: 3 }} />
          <div className="wsy-block" style={{ ['--i' as string]: 4 }}>
            <div className="wsy-shimmer h-8 w-24 rounded-md" />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="wsy-block wsy-shimmer h-14 rounded-lg" style={{ ['--i' as string]: 5 }} />
            <div className="wsy-block wsy-shimmer h-14 rounded-lg" style={{ ['--i' as string]: 6 }} />
            <div className="wsy-block wsy-shimmer h-14 rounded-lg" style={{ ['--i' as string]: 7 }} />
          </div>

          {/* AI tarama ışığı (tepeden iner) */}
          <div className="wsy-scan pointer-events-none absolute inset-x-0 top-0 h-10" aria-hidden />
        </div>
      </div>

      {/* başlık + açıklama */}
      <h2 className="mt-7 text-lg font-semibold tracking-tight text-gray-900">{t('preparingTitle')}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-gray-500">{t('preparingDesc')}</p>

      {/* dönen üretim aşaması */}
      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary" aria-live="polite">
        <span className="relative flex h-2 w-2">
          <span className="wsy-ping absolute inline-flex h-full w-full rounded-full bg-primary/50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span key={stage} className="wsy-stage">{stages[stage]}</span>
      </div>

      {/* ilerleme çubuğu — belirli (progress prop) veya belirsiz (animasyonlu) */}
      <div className="mt-3 h-1 w-40 overflow-hidden rounded-full bg-primary/10" aria-hidden>
        {progress !== undefined ? (
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        ) : (
          <div className="wsy-progress h-full w-1/3 rounded-full bg-primary" />
        )}
      </div>

      {/* son log satırı (gerçek iş günlüğü — yalnız bayrak açıkken dolu olur) */}
      {lastLog ? (
        <p className="mt-2 max-w-xs truncate text-xs text-gray-400" aria-live="polite">
          {lastLog}
        </p>
      ) : null}
    </div>
  )
}
