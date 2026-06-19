'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Globe, Rocket, ExternalLink, Copy, Check, Loader2, Sparkles, Lock } from 'lucide-react'

interface PublishPopupProps {
  open: boolean
  onClose: () => void
  /** Yayınla/Yayından kaldır isteği (parent → /publish). */
  onPublish: () => void
  /** Yayından kaldır (yayınlıysa). */
  onUnpublish: () => void
  publishing: boolean
  isPublished: boolean
  /** Yayınlanmış canlı URL — markalı `/s/<subdomain>` (ASLA .vercel.app). */
  liveHref?: string
  /** Markalı geçici/taslak önizleme URL (builder-7 /preview-url — ASLA .vercel.app). */
  previewUrl: string | null
  loadingPreview: boolean
}

/**
 * #builder-8c — "Yayınla" popup'ı. Markalı önizleme/canlı URL'i (builder-7 /preview-url
 * + yayınlanınca `/s/<subdomain>`) gösterir; .vercel.app HİÇBİR yerde görünmez.
 *
 * - "Yayınla" onayı → POST /publish (parent). Yayınlıysa canlı URL + "Yayından kaldır".
 * - "Ücretsiz geçici yayınla" = markalı önizleme zaten geçici yayın (yeni sekmede açılır;
 *   kredi/abonelik gerekmez).
 * - Kendi alan adı bağlama (önerilen domain / kendi domainini getir) = Faz 2 →
 *   etiketli "Yakında" bölümü (yarım domain mantığı KURULMAZ).
 *
 * Modal → animate-card-enter EKLENMEZ (kendi açılış animasyonu). Amber/sarı YASAK.
 */
export default function PublishPopup({
  open,
  onClose,
  onPublish,
  onUnpublish,
  publishing,
  isPublished,
  liveHref,
  previewUrl,
  loadingPreview,
}: PublishPopupProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi.builder.publishPopup')
  const [copied, setCopied] = useState(false)

  // ESC ile kapat + body scroll lock.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !publishing) onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, publishing, onClose])

  useEffect(() => { setCopied(false) }, [open])

  if (!open) return null

  // Gösterilecek URL: yayınlıysa canlı `/s/`, değilse markalı önizleme. Mutlak URL'e çevir
  // (path ise origin ekle) — ama yalnızca tarayıcıda (window) varsa.
  const displayUrl = isPublished && liveHref ? liveHref : previewUrl
  const absoluteUrl =
    displayUrl && typeof window !== 'undefined' && displayUrl.startsWith('/')
      ? `${window.location.origin}${displayUrl}`
      : displayUrl

  const prettyUrl = absoluteUrl ? absoluteUrl.replace(/^https?:\/\//, '') : ''

  const copyUrl = async () => {
    if (!absoluteUrl) return
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard yoksa sessiz geç */
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('title')}>
      <button
        type="button"
        aria-label={t('close')}
        onClick={() => { if (!publishing) onClose() }}
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl animate-[wsy-pop-in_.2s_ease] overflow-hidden">
        {/* Başlık */}
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
            {isPublished ? <Globe className="w-4.5 h-4.5" /> : <Rocket className="w-4.5 h-4.5" />}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{isPublished ? t('publishedTitle') : t('title')}</h2>
            <p className="text-sm text-gray-500 truncate">{isPublished ? t('publishedHint') : t('hint')}</p>
          </div>
          <button
            type="button"
            onClick={() => { if (!publishing) onClose() }}
            disabled={publishing}
            aria-label={t('close')}
            className="ml-auto text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Markalı URL kartı (canlı veya geçici önizleme) */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5">
            <p className="text-caption uppercase tracking-wide text-gray-400">
              {isPublished ? t('liveUrlLabel') : t('previewUrlLabel')}
            </p>
            {loadingPreview && !displayUrl ? (
              <div className="mt-1.5 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> {t('loadingUrl')}
              </div>
            ) : prettyUrl ? (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-800" title={prettyUrl}>{prettyUrl}</span>
                <button
                  type="button"
                  onClick={copyUrl}
                  title={t('copy')}
                  aria-label={t('copy')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50/60 transition-colors active:scale-[0.97]"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                {absoluteUrl && (
                  <a
                    href={absoluteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t('open')}
                    aria-label={t('open')}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50/60 transition-colors active:scale-[0.97]"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-gray-500">{t('noUrl')}</p>
            )}
            {!isPublished && (
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{t('previewFreeHint')}</p>
            )}
          </div>

          {/* Birincil aksiyon */}
          {isPublished ? (
            <div className="flex flex-col gap-2.5">
              {liveHref && (
                <a
                  href={absoluteUrl ?? liveHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 active:scale-[0.97] transition-all"
                >
                  <ExternalLink className="w-4 h-4" /> {t('viewLive')}
                </a>
              )}
              <button
                type="button"
                onClick={onUnpublish}
                disabled={publishing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50"
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                {publishing ? t('working') : t('unpublish')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onPublish}
              disabled={publishing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {publishing ? t('publishing') : t('publishNow')}
            </button>
          )}

          {/* Faz 2 — kendi alan adı bağlama (Yakında stub; yarım mantık KURULMAZ) */}
          <div className="rounded-xl border border-gray-200 p-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-base font-medium text-gray-700">{t('domainTitle')}</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-600 text-caption px-2 py-0.5">
                <Lock className="w-3 h-3" /> {t('soon')}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">{t('domainHint')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
