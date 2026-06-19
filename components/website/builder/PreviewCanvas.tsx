'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { DESIGN_W, type Device } from './DeviceSwitcher'

interface PreviewCanvasProps {
  websiteId: string
  locale: string
  slug: string
  device: Device
  /** Her artışta iframe yeniden yüklenir (revize/yayın/tasarım sonrası tazeleme). */
  reloadKey: number
  /** AI revize/işlem sürüyor → tuvalin üstüne "revize ediliyor" perdesi. */
  revising?: boolean
}

/**
 * #builder-8a — BÜYÜK canvas (Promake tarzı). Sıkışık dashboard iframe'i kaldırıldı:
 * iframe seçili cihazın GERÇEK viewport genişliğinde (DESIGN_W) render edilir, sonra mevcut
 * merkez alanı DOLDURACAK şekilde ölçeklenir (transform: scale). Tuval, görünür alanın çoğunu
 * kaplar — küçük bir kart DEĞİL.
 *
 * İzolasyon (KRİTİK — iki katmanlı): Bu (dış) iframe, sahip-oturumlu same-origin
 * `/website-preview/<id>?locale=&slug=` sayfasını yükler — o sayfa, oturum cookie'sine ihtiyaç
 * duyduğu için dış iframe'e `sandbox` KONULMAZ (mevcut detay/onizleme davranışıyla aynı).
 * Gerçek izolasyon İÇERİDE: o sayfa codegen (format='html') taslaklarını KENDİ içinde
 * `sandbox="allow-scripts allow-forms"` (allow-same-origin YOK) ile basar → üretilen kod
 * dashboard origin'ine erişemez. 8b görsel-seçim katmanı için temiz dikiş: dış sarmalayıcıda
 * `data-builder-canvas` + iframe'de `data-builder-frame` işareti bırakıldı (gelecekteki
 * VisualEditLayer overlay'i bu sarmalayıcıya bindirilecek, postMessage köprüsü bu frame'e).
 */
export default function PreviewCanvas({
  websiteId,
  locale,
  slug,
  device,
  reloadKey,
  revising = false,
}: PreviewCanvasProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const areaRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState({ w: 0, h: 0 })

  // Merkez alanın gerçek boyutunu ölç → iframe'i bu alana sığacak (FILL) biçimde ölçekle.
  useEffect(() => {
    const el = areaRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setArea({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setArea({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const designW = DESIGN_W[device]
  // Tasarım yüksekliği: masaüstünde alanı dolduracak kadar uzun; mobil/tablette cihaz hissi için
  // alan yüksekliğinden türetilir. iframe içeriği zaten kendi içinde scroll eder.
  const PADDING = device === 'desktop' ? 0 : 40
  const availW = Math.max(0, area.w - PADDING * 2)
  const availH = Math.max(0, area.h - PADDING * 2)
  // Masaüstü: genişliğe göre ölçekle (en boy oranı içerikten gelir, tuval tam yükseklikte).
  // Tablet/mobil: cihaz çerçevesi hissi — yüksekliği de sınırla.
  const designH = device === 'desktop' ? Math.max(availH, 760) : Math.max(availH, 760)
  const scaleW = availW > 0 ? availW / designW : 1
  const scaleH = device === 'desktop' ? 1 : availH > 0 ? availH / designH : 1
  const scale = Math.min(1.2, Math.max(0.1, Math.min(scaleW, scaleH)))

  const isMobileLike = device !== 'desktop'

  return (
    <div
      ref={areaRef}
      data-builder-canvas
      className="relative flex-1 min-h-0 flex items-start justify-center overflow-hidden bg-gradient-to-b from-gray-100 to-gray-200/70"
      style={{ padding: PADDING }}
    >
      {revising && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/75 backdrop-blur-sm gap-4">
          <div className="relative flex items-center justify-center">
            <span className="absolute inset-0 -m-9 rounded-full wsy-revising-glow" aria-hidden="true" />
            <Sparkles strokeWidth={1.25} className="relative w-[4.5rem] h-[4.5rem] text-primary wsy-revising" />
          </div>
          <p className="text-2xl font-light text-primary wsy-revising">{t('revising')}</p>
        </div>
      )}

      {/* Ölçekli iframe: GERÇEK cihaz viewport'unda render → responsive kırılımlar doğru.
          Dış iframe SANDBOX'SUZ (same-origin owner preview sayfası — cookie gerekir); izolasyon
          o sayfanın İÇİNDEKİ sandbox'lı iframe'de (yukarıdaki nota bakın). */}
      <iframe
        data-builder-frame
        key={`${locale}-${slug}-${reloadKey}`}
        src={`/website-preview/${websiteId}?locale=${encodeURIComponent(locale)}&slug=${encodeURIComponent(slug)}`}
        title={t('builder.preview')}
        className="border-0 bg-white shrink-0"
        style={{
          width: designW,
          height: designH,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          boxShadow: isMobileLike ? '0 24px 60px -20px rgba(15,23,42,0.45)' : '0 12px 40px -16px rgba(15,23,42,0.25)',
          borderRadius: isMobileLike ? 28 : 12,
        }}
      />
    </div>
  )
}
