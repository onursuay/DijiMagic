'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Sparkles, RefreshCw, Globe, ExternalLink, ArrowLeft, Monitor, Smartphone, ImagePlus, History, RotateCcw, ChevronDown, Eye, AlertCircle } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { ToastContainer, type Toast } from '@/components/Toast'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import DomainPanel from '@/components/website/DomainPanel'
import type { Website, WebsitePage, WebsiteVersionMeta } from '@/lib/website/types'

type Busy = 'ai' | 'quick' | 'publish' | 'logo' | 'rollback' | null
type Device = 'desktop' | 'mobile'

const LOCALE_NAMES: Record<string, string> = {
  tr: 'Türkçe', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', ar: 'العربية', it: 'Italiano', ru: 'Русский',
}
const localeName = (l: string) => LOCALE_NAMES[l] ?? l.toUpperCase()

// Sayfa sekmesi etiketleri — önizlenen SİTE diline göre (header nav ile tutarlı olsun)
const PAGE_LABELS: Record<string, Record<string, string>> = {
  tr: { home: 'Ana Sayfa', about: 'Hakkımızda', services: 'Hizmetler', contact: 'İletişim' },
  en: { home: 'Home', about: 'About', services: 'Services', contact: 'Contact' },
  de: { home: 'Startseite', about: 'Über uns', services: 'Leistungen', contact: 'Kontakt' },
  fr: { home: 'Accueil', about: 'À propos', services: 'Services', contact: 'Contact' },
  es: { home: 'Inicio', about: 'Nosotros', services: 'Servicios', contact: 'Contacto' },
}

const DESIGN_W: Record<Device, number> = { desktop: 1280, mobile: 390 }
const DESIGN_H = 760

export default function WebSiteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const id = String(params?.id ?? '')
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const uiLocale = useLocale()

  const [site, setSite] = useState<Website | null>(null)
  const [pages, setPages] = useState<WebsitePage[]>([])
  const [activeSlug, setActiveSlug] = useState<string>('home')
  const [previewLocale, setPreviewLocale] = useState<string>('tr')
  const [busy, setBusy] = useState<Busy>(null)
  const [genError, setGenError] = useState('')
  const [showCredit, setShowCredit] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [device, setDevice] = useState<Device>('desktop')
  const [reloadKey, setReloadKey] = useState(0)
  const [versions, setVersions] = useState<WebsiteVersionMeta[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const frameWrapRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [wrapW, setWrapW] = useState(0)

  const addToast = useCallback((message: string, type: Toast['type']) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, type }])
  }, [])
  const removeToast = useCallback((tid: string) => setToasts((p) => p.filter((x) => x.id !== tid)), [])

  const load = useCallback(async () => {
    if (!id) return
    const [sRes, pRes] = await Promise.all([
      fetch(`/api/website/${id}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/website/${id}/pages`).then((r) => r.json()).catch(() => null),
    ])
    if (sRes?.ok) { setSite(sRes.website); setPreviewLocale(sRes.website.defaultLocale || 'tr') }
    if (pRes?.ok) setPages(pRes.pages ?? [])
  }, [id])

  const fetchVersions = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/website/${id}/versions`).then((r) => r.json()).catch(() => null)
    if (res?.ok) setVersions(res.versions ?? [])
  }, [id])

  useEffect(() => { load(); fetchVersions() }, [load, fetchVersions])

  // Önizleme kutusunun gerçek genişliğini ölç (iframe'i ölçekleyip gerçek viewport düzeni göster)
  useEffect(() => {
    const el = frameWrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setWrapW(el.clientWidth))
    ro.observe(el)
    setWrapW(el.clientWidth)
    return () => ro.disconnect()
  }, [pages.length])

  const pageLabel = (p: WebsitePage) => {
    const m = PAGE_LABELS[previewLocale] ?? PAGE_LABELS.en
    return m[p.pageRole] ?? p.slug
  }

  const localePages = pages.filter((p) => p.locale === previewLocale)
  const visiblePages = localePages.length ? localePages : pages
  const activePage = visiblePages.find((p) => p.slug === activeSlug) ?? visiblePages[0] ?? null
  const activeSlugSafe = activePage?.slug ?? 'home'
  const isPublished = site?.status === 'published'
  const hasPages = pages.length > 0
  const siteLocales = site?.locales ?? []

  const designW = DESIGN_W[device]
  const scale = wrapW > 0 ? Math.min(1, wrapW / designW) : 1

  const handleAi = async (override?: string) => {
    setBusy('ai'); setGenError('')
    try {
      const res = await fetch(`/api/website/${id}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instructions: override ?? '' }),
      })
      if (res.status === 402) { setShowCredit(true); return }
      const json = await res.json()
      if (json.ok) { setPages(json.pages ?? []); setActiveSlug('home'); setReloadKey((k) => k + 1); fetchVersions() }
      else { const m = json.error || t('buildError'); setGenError(m); addToast(m, 'error') }
    } catch { setGenError(t('buildError')); addToast(t('buildError'), 'error') } finally { setBusy(null) }
  }

  const handleQuick = async () => {
    setBusy('quick'); setGenError('')
    try {
      const res = await fetch(`/api/website/${id}/build`, { method: 'POST' })
      const json = await res.json()
      if (json.ok) { setPages(json.pages ?? []); setActiveSlug('home'); setReloadKey((k) => k + 1); fetchVersions() }
      else { setGenError(t('buildError')); addToast(t('buildError'), 'error') }
    } catch { setGenError(t('buildError')); addToast(t('buildError'), 'error') } finally { setBusy(null) }
  }

  // Wizard'dan ?create=ai|quick ile gelince ilk üretimi otomatik başlat (yalnız bir kez, sayfa boşsa).
  const autoStarted = useRef(false)
  useEffect(() => {
    if (autoStarted.current || !site || busy) return
    if (pages.length > 0) { autoStarted.current = true; return }
    const mode = search.get('create')
    if (mode === 'ai' || mode === 'quick') {
      autoStarted.current = true
      router.replace(`/web-site-yoneticisi/${id}`, { scroll: false }) // ?create temizle → reload'da tekrar tetiklenmez
      if (mode === 'ai') void handleAi(site.theme?.initialInstructions ?? '')
      else void handleQuick()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, pages.length])

  const handleRollback = async (versionId: string) => {
    setBusy('rollback')
    try {
      const res = await fetch(`/api/website/${id}/versions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionId }),
      })
      const json = await res.json()
      if (json.ok) { setPages(json.pages ?? []); setActiveSlug('home'); setReloadKey((k) => k + 1); fetchVersions() }
      else addToast(json.error || t('rollbackError'), 'error')
    } catch { addToast(t('rollbackError'), 'error') } finally { setBusy(null) }
  }

  const reasonLabel = (r: string) =>
    r === 'revision' ? t('reasonRevision') : r === 'rollback' ? t('reasonRollback') : t('reasonInitial')
  const fmtDate = (s: string) => {
    try { return new Date(s).toLocaleString(uiLocale === 'en' ? 'en-US' : 'tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return s }
  }

  const handlePublish = async (action: 'publish' | 'unpublish') => {
    setBusy('publish')
    try {
      const res = await fetch(`/api/website/${id}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (json.ok && json.website) { setSite(json.website); if (action === 'publish') addToast(t('publishSuccess'), 'success') }
      else addToast(json.error || t('publishError'), 'error')
    } catch { addToast(t('publishError'), 'error') } finally { setBusy(null) }
  }

  const handleLogoFile = async (file: File | undefined) => {
    if (!file) return
    setBusy('logo')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/website/${id}/logo`, { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok && json.website) { setSite(json.website); setReloadKey((k) => k + 1) }
      else addToast(json.error || t('logoError'), 'error')
    } catch { addToast(t('logoError'), 'error') } finally { setBusy(null) }
  }

  const deviceBtn = (d: Device, Icon: typeof Monitor, label: string) => (
    <button
      onClick={() => setDevice(d)}
      aria-label={label}
      className={`rounded-md p-1.5 transition-colors ${device === d ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-700'}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  )

  return (
    <>
      <Topbar title={site?.label ?? t('title')} description={site?.subdomain ?? ''} />
      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="max-w-7xl mx-auto space-y-5">
          <Link
            href="/web-site-yoneticisi"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {t('backToList')}
          </Link>

          {/* Üretim durumu + aksiyonlar (intake wizard'a taşındı; burada tekrar sorulmaz) */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 animate-card-enter">
            {busy === 'ai' || busy === 'quick' ? (
              <div className="py-8 flex flex-col items-center text-center gap-3">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                <h2 className="text-base font-semibold text-gray-900">{t('preparingTitle')}</h2>
                <p className="text-sm leading-relaxed text-gray-500 max-w-md">{t('preparingDesc')}</p>
              </div>
            ) : !hasPages ? (
              <div className="py-6 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">{t('noPagesTitle')}</h2>
                {genError ? (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700 max-w-md">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {genError}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-gray-600 max-w-md">{t('noPagesDesc')}</p>
                )}
                <button
                  onClick={() => handleAi(site?.theme?.initialInstructions ?? '')}
                  disabled={busy !== null}
                  className="mt-1 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white active:scale-[0.97] transition-all disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4" /> {genError ? t('retry') : t('aiBuild')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900">{t('reviewActionsTitle')}</h2>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                      {isPublished ? t('statusPublished') : site?.status === 'unpublished' ? t('statusUnpublished') : t('statusDraft')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{t('reviewActionsHint')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => { handleLogoFile(e.target.files?.[0]); e.target.value = '' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy !== null}
                    aria-label={t('logoChange')}
                    className="rounded-lg border border-gray-200 text-gray-600 p-2.5 hover:bg-gray-50/60 transition-colors disabled:opacity-50"
                  >
                    {busy === 'logo' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => router.push(`/web-site-yoneticisi/${id}/onizleme`)}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white active:scale-[0.97] transition-all"
                  >
                    <Eye className="w-4 h-4" /> {t('detailedPreview')}
                  </button>
                  <button
                    onClick={() => handlePublish(isPublished ? 'unpublish' : 'publish')}
                    disabled={busy !== null}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium active:scale-[0.97] transition-all disabled:opacity-50 ${isPublished ? 'border border-gray-200 text-gray-700 hover:bg-gray-50/60' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  >
                    <Globe className="w-4 h-4" />
                    {busy === 'publish' ? t('publishing') : isPublished ? t('unpublish') : t('publish')}
                  </button>
                  {isPublished && (
                    <a href={`/s/${site?.subdomain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
                      <ExternalLink className="w-4 h-4" /> {t('viewLive')}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sürüm geçmişi (Faz 2 — geri alma) */}
          {hasPages && versions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 animate-card-enter overflow-hidden">
              <button
                onClick={() => setShowHistory((s) => !s)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50/60 transition-colors"
              >
                <History className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-800">{t('historyTitle')}</span>
                <span className="text-xs text-gray-400">({versions.length})</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>
              {showHistory && (
                <ul className="border-t border-gray-100 divide-y divide-gray-100">
                  {versions.map((v, i) => (
                    <li key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-xs px-2 py-0.5">
                        {reasonLabel(v.reason)}
                      </span>
                      <span className="text-xs text-gray-500">{fmtDate(v.createdAt)}</span>
                      {i === 0 ? (
                        <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500" title={t('currentVersion')} />
                      ) : (
                        <button
                          onClick={() => handleRollback(v.id)}
                          disabled={busy !== null}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {busy === 'rollback' ? t('rollingBack') : t('rollback')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Faz 3 — kendi alan adı */}
          {hasPages && <DomainPanel websiteId={id} />}

          {/* Önizleme / boş durum */}
          {!hasPages ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center animate-card-enter">
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">{t('noPagesTitle')}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600 max-w-md mx-auto">{t('noPagesDesc')}</p>
            </div>
          ) : (
            <div className="space-y-3 animate-card-enter">
              {/* Kontrol satırı: dil + sayfa sekmeleri (solda) · cihaz toggle (sağda) */}
              <div className="flex flex-wrap items-center gap-3">
                {siteLocales.length > 1 && (
                  <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white">
                    {siteLocales.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => setPreviewLocale(loc)}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                          previewLocale === loc ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        {localeName(loc)}
                      </button>
                    ))}
                  </div>
                )}
                {visiblePages.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {visiblePages.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setActiveSlug(p.slug)}
                        className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                          activePage?.slug === p.slug ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50/60'
                        }`}
                      >
                        {pageLabel(p)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="ml-auto inline-flex items-center rounded-lg border border-gray-200 p-0.5 bg-white">
                  {deviceBtn('desktop', Monitor, t('deviceDesktop'))}
                  {deviceBtn('mobile', Smartphone, t('deviceMobile'))}
                </div>
              </div>

              {/* Tarayıcı çerçevesi + ölçekli iframe (gerçek viewport → responsive doğru) */}
              <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                <div className="flex items-center gap-2 px-4 h-10 border-b border-gray-100 bg-gray-50/60">
                  <span className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  </span>
                  <span className="ml-2 text-xs text-gray-500 truncate">
                    {site?.subdomain}{activeSlugSafe !== 'home' ? `/${activeSlugSafe}` : ''}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">{t('preview')}</span>
                </div>
                <div ref={frameWrapRef} className="bg-gray-100 flex justify-center overflow-hidden" style={{ height: DESIGN_H * scale }}>
                  <iframe
                    key={`${previewLocale}-${activeSlugSafe}-${reloadKey}`}
                    src={`/website-preview/${id}?locale=${previewLocale}&slug=${activeSlugSafe}`}
                    title={t('preview')}
                    className="border-0 bg-white shrink-0"
                    style={{
                      width: designW,
                      height: DESIGN_H,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top center',
                      boxShadow: device === 'mobile' ? '0 10px 40px -12px rgba(0,0,0,0.3)' : 'none',
                      borderRadius: device === 'mobile' ? 18 : 0,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCredit && (
        <AccessRequiredModal
          type="credit"
          featureKey="website_generation"
          dismissible
          onClose={() => setShowCredit(false)}
          reason="website_generation_gate"
        />
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
