'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { DESIGN_W, type Device } from './DeviceSwitcher'
import VisualEditLayer from './VisualEditLayer'
import { parseSelectMessage, parseRect, type VisualEditOp, type VisualSelection } from './visualEditTypes'

interface PreviewCanvasProps {
  websiteId: string
  locale: string
  slug: string
  device: Device
  /** Her artışta iframe yeniden yüklenir (revize/yayın/tasarım sonrası tazeleme). */
  reloadKey: number
  /** AI revize/işlem sürüyor → tuvalin üstüne "revize ediliyor" perdesi. */
  revising?: boolean
  /**
   * #builder-8b — VISUAL EDIT modu. Açıksa iframe `builder=1` ile yüklenir (assemble
   * 'builder' → tuval içi seçim katmanı), postMessage ile blok seçimi dinlenir ve
   * seçili bloğun üstüne overlay + araç çubuğu çizilir. Kapalıysa davranış AYNEN korunur.
   */
  builder?: boolean
  selection?: VisualSelection | null
  onSelect?: (sel: VisualSelection) => void
  /** Patch sürüyor mu (araç çubuğu butonlarını devre dışı bırakır). */
  busy?: VisualEditOp | null
  canMoveUp?: boolean
  canMoveDown?: boolean
  onEditContent?: () => void
  onAiRewrite?: () => void
  onDelete?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
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
  builder = false,
  selection = null,
  onSelect,
  busy = null,
  canMoveUp = false,
  canMoveDown = false,
  onEditContent,
  onAiRewrite,
  onDelete,
  onMoveUp,
  onMoveDown,
}: PreviewCanvasProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const areaRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
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

  // #builder-8b — send a command to the in-iframe builder runtime (highlight/clear).
  const postToFrame = useCallback((msg: Record<string, unknown>) => {
    const win = frameRef.current?.contentWindow
    if (!win) return
    // The canvas inner iframe is sandboxed (opaque origin) → target '*'. The runtime
    // only acts on commands from its parent window (e.source check), and the payload
    // carries NO secrets (just a block id). No same-origin access is granted.
    try { win.postMessage(msg, '*') } catch { /* ignore */ }
  }, [])

  // #builder-8b — live rect override (the runtime re-emits 'yoai:rect' on scroll/resize
  // so the overlay tracks the block). Keyed off the selected block id; cleared on change.
  const [liveRect, setLiveRect] = useState<VisualSelection['rect'] | null>(null)

  // #builder-8b — listen for postMessage from the canvas iframe (select layer). The
  // iframe is sandboxed (opaque origin → event.origin === 'null'); the robust channel
  // check is event.source === the iframe's contentWindow. We additionally VALIDATE the
  // payload shape (parseSelectMessage / parseRect) before acting — never trust raw data.
  useEffect(() => {
    if (!builder) return
    const onMessage = (e: MessageEvent) => {
      // SECURITY: only accept messages from OUR canvas iframe window (not any frame/tab).
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return
      const data = e.data as Record<string, unknown> | null
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return

      if (data.type === 'yoai:select') {
        const sel = parseSelectMessage(data)
        if (sel) { setLiveRect(null); onSelect?.(sel) }
        return
      }
      if (data.type === 'yoai:rect') {
        // Only refresh the rect of the CURRENTLY selected block (ignore stale ids).
        const id = typeof data.blockId === 'string' ? data.blockId.trim() : ''
        if (selection && id === selection.blockId) {
          const r = parseRect(data.rect)
          if (r) setLiveRect(r)
        }
        return
      }
      // 'yoai:ready' → re-assert the current selection so the in-iframe highlight matches
      // the parent state after a reload (the parent state survives an iframe refresh).
      if (data.type === 'yoai:ready' && selection) {
        postToFrame({ type: 'yoai:highlight', blockId: selection.blockId })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [builder, onSelect, selection, postToFrame])

  // Mirror the parent selection into the iframe highlight (and clear when deselected).
  useEffect(() => {
    if (!builder) return
    if (selection) postToFrame({ type: 'yoai:highlight', blockId: selection.blockId })
    else postToFrame({ type: 'yoai:clear' })
    setLiveRect(null)
  }, [builder, selection, postToFrame, reloadKey])

  const designW = DESIGN_W[device]
  // Tasarım yüksekliği: masaüstünde alanı dolduracak kadar uzun; mobil/tablette cihaz hissi için
  // alan yüksekliğinden türetilir. iframe içeriği zaten kendi içinde scroll eder.
  // #builder-8d — masaüstünde de hafif padding: yumuşak zemin tuvalin çevresinde nefes alsın,
  // cihaz çerçevesi gölgesi/yuvarlağı görünsün (kahraman tuval hissi).
  const PADDING = device === 'desktop' ? 24 : 40
  const availW = Math.max(0, area.w - PADDING * 2)
  const availH = Math.max(0, area.h - PADDING * 2)
  // Masaüstü: genişliğe göre ölçekle (en boy oranı içerikten gelir, tuval tam yükseklikte).
  // Tablet/mobil: cihaz çerçevesi hissi — yüksekliği de sınırla.
  const designH = device === 'desktop' ? Math.max(availH, 760) : Math.max(availH, 760)
  const scaleW = availW > 0 ? availW / designW : 1
  const scaleH = device === 'desktop' ? 1 : availH > 0 ? availH / designH : 1
  const scale = Math.min(1.2, Math.max(0.1, Math.min(scaleW, scaleH)))

  const isMobileLike = device !== 'desktop'

  // #builder-8b — the iframe's VISUAL top-left within the area, for overlay mapping.
  // The iframe is horizontally centered (justify-center) at PADDING top, and scaled
  // with transformOrigin 'top center', so the scaled box (designW*scale wide) is
  // centered in the available width. left = PADDING + (availW - designW*scale)/2.
  const iframeLeft = PADDING + Math.max(0, (availW - designW * scale) / 2)
  const iframeTop = PADDING
  // Use the live (scroll-updated) rect when present, else the selection's own rect.
  const overlaySelection = selection
    ? { ...selection, rect: liveRect ?? selection.rect }
    : null
  const showOverlay = builder && !!overlaySelection && !revising

  return (
    <div
      ref={areaRef}
      data-builder-canvas
      className="relative flex-1 min-h-0 flex items-start justify-center overflow-hidden bg-gradient-to-b from-emerald-50/40 via-gray-50 to-gray-100/70"
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
        ref={frameRef}
        data-builder-frame
        key={`${locale}-${slug}-${reloadKey}`}
        src={`/website-preview/${websiteId}?locale=${encodeURIComponent(locale)}&slug=${encodeURIComponent(slug)}${builder ? '&builder=1' : ''}`}
        title={t('builder.preview')}
        className="border-0 bg-white shrink-0"
        style={{
          width: designW,
          height: designH,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          // Katmanlı yumuşak gölge (düz shadow-md DEĞİL) — derinlik + cihaz çerçevesi hissi.
          boxShadow: isMobileLike
            ? '0 24px 60px -20px rgba(15,23,42,0.45), 0 2px 6px -2px rgba(15,23,42,0.12)'
            : '0 24px 60px -24px rgba(15,23,42,0.28), 0 6px 18px -8px rgba(15,23,42,0.10), 0 0 0 1px rgba(15,23,42,0.04)',
          borderRadius: isMobileLike ? 28 : 14,
        }}
      />

      {/* #builder-8b — seçili bloğun üstüne çizilen highlight + inline araç çubuğu.
          Sandbox/izolasyon korunur: kutu, postMessage ile gelen rect'in (iframe koordinatı)
          ölçek + ortalama ile parent koordinatına eşlenmesiyle çizilir; iç DOM'a erişilmez. */}
      {showOverlay && (
        <VisualEditLayer
          selection={overlaySelection}
          scale={scale}
          iframeLeft={iframeLeft}
          iframeTop={iframeTop}
          busy={busy}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onEditContent={() => onEditContent?.()}
          onAiRewrite={() => onAiRewrite?.()}
          onDelete={() => onDelete?.()}
          onMoveUp={() => onMoveUp?.()}
          onMoveDown={() => onMoveDown?.()}
        />
      )}
    </div>
  )
}
