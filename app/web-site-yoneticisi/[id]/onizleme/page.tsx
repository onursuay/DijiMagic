'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Check, X, Pencil, Monitor, Tablet, Smartphone, ExternalLink, Sparkles, Send, ThumbsDown } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { ToastContainer, type Toast } from '@/components/Toast'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import DictateButton from '@/components/website/DictateButton'
import type { Website, WebsitePage } from '@/lib/website/types'

type Device = 'desktop' | 'tablet' | 'mobile'
const DESIGN_W: Record<Device, number> = { desktop: 1280, tablet: 834, mobile: 390 }
const DESIGN_H = 820

const LOCALE_NAMES: Record<string, string> = {
  tr: 'Türkçe', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', ar: 'العربية', it: 'Italiano', ru: 'Русский',
}
const localeName = (l: string) => LOCALE_NAMES[l] ?? l.toUpperCase()
const PAGE_LABELS: Record<string, Record<string, string>> = {
  tr: { home: 'Ana Sayfa', about: 'Hakkımızda', services: 'Hizmetler', contact: 'İletişim' },
  en: { home: 'Home', about: 'About', services: 'Services', contact: 'Contact' },
}

export default function WebsiteReviewPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params?.id ?? '')
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const uiLocale = useLocale()

  const [site, setSite] = useState<Website | null>(null)
  const [pages, setPages] = useState<WebsitePage[]>([])
  const [previewLocale, setPreviewLocale] = useState('tr')
  const [activeSlug, setActiveSlug] = useState('home')
  const [device, setDevice] = useState<Device>('desktop')
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState<'reject' | 'edit' | 'approve' | null>(null)
  const [panel, setPanel] = useState<'reject' | 'edit' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [showCredit, setShowCredit] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const frameWrapRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const el = frameWrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setWrapW(el.clientWidth))
    ro.observe(el)
    setWrapW(el.clientWidth)
    return () => ro.disconnect()
  }, [pages.length, device])

  const localePages = pages.filter((p) => p.locale === previewLocale)
  const visiblePages = localePages.length ? localePages : pages
  const activePage = visiblePages.find((p) => p.slug === activeSlug) ?? visiblePages[0] ?? null
  const activeSlugSafe = activePage?.slug ?? 'home'
  const siteLocales = site?.locales ?? []
  const isPublished = site?.status === 'published'
  const designW = DESIGN_W[device]
  const scale = wrapW > 0 ? Math.min(1, (wrapW - (device === 'mobile' ? 0 : 32)) / designW) : 1
  const pageLabel = (p: WebsitePage) => (PAGE_LABELS[previewLocale] ?? PAGE_LABELS.en)[p.pageRole] ?? p.slug

  const revise = async (mode: 'reject' | 'edit') => {
    const text = feedback.trim()
    if (!text) return
    // Revize başlar başlamaz giriş kutusunu gizle — istek uçarken textarea+butonlar
    // görünmesin; büyük "revize ediliyor" göstergesi (overlay) öne çıksın.
    setPanel(null)
    setBusy(mode)
    try {
      const res = await fetch(`/api/website/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: text, revisionMode: mode }),
      })
      if (res.status === 402) { setShowCredit(true); setPanel(null); setFeedback(''); return }
      const json = await res.json()
      if (json.ok) {
        setPages(json.pages ?? [])
        setActiveSlug('home')
        setReloadKey((k) => k + 1)
        setPanel(null)
        setFeedback('')
        addToast(t('revisionDone'), 'success')
      } else addToast(json.error || t('buildError'), 'error')
    } catch { addToast(t('buildError'), 'error') } finally { setBusy(null) }
  }

  const approve = async () => {
    setBusy('approve')
    try {
      const res = await fetch(`/api/website/${id}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }),
      })
      const json = await res.json()
      if (json.ok && json.website) { setSite(json.website); addToast(t('publishSuccess'), 'success') }
      else addToast(json.error || t('publishError'), 'error')
    } catch { addToast(t('publishError'), 'error') } finally { setBusy(null) }
  }

  const deviceBtn = (d: Device, Icon: typeof Monitor) => (
    <button
      onClick={() => setDevice(d)}
      aria-label={t(d === 'desktop' ? 'deviceDesktop' : d === 'tablet' ? 'deviceTablet' : 'deviceMobile')}
      className={`rounded-md p-1.5 transition-colors ${device === d ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-700'}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  )

  const working = busy !== null

  return (
    <>
      <Topbar title={site?.label ?? t('detailedPreview')} description={t('reviewSubtitle')} />
      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Link href={`/web-site-yoneticisi/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t('backToEditor')}
          </Link>

          {/* Kontrol satırı */}
          <div className="flex flex-wrap items-center gap-3">
            {siteLocales.length > 1 && (
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white">
                {siteLocales.map((loc) => (
                  <button key={loc} onClick={() => setPreviewLocale(loc)} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${previewLocale === loc ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-gray-800'}`}>
                    {localeName(loc)}
                  </button>
                ))}
              </div>
            )}
            {visiblePages.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {visiblePages.map((p) => (
                  <button key={p.id} onClick={() => setActiveSlug(p.slug)} className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${activePage?.slug === p.slug ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50/60'}`}>
                    {pageLabel(p)}
                  </button>
                ))}
              </div>
            )}
            <div className="ml-auto inline-flex items-center rounded-lg border border-gray-200 p-0.5 bg-white">
              {deviceBtn('desktop', Monitor)}
              {deviceBtn('tablet', Tablet)}
              {deviceBtn('mobile', Smartphone)}
            </div>
          </div>

          {/* Büyük responsive önizleme */}
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
            <div className="flex items-center gap-2 px-4 h-10 border-b border-gray-100 bg-gray-50/60">
              <span className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              </span>
              <span className="ml-2 text-xs text-gray-500 truncate">{site?.subdomain}{activeSlugSafe !== 'home' ? `/${activeSlugSafe}` : ''}</span>
              {isPublished && <span className="ml-auto inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5">{t('statusPublished')}</span>}
            </div>
            <div ref={frameWrapRef} className="relative bg-gray-100 flex justify-center overflow-hidden" style={{ height: DESIGN_H * scale }}>
              {working && busy !== 'approve' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/75 backdrop-blur-sm gap-4">
                  <div className="relative flex items-center justify-center">
                    <span className="absolute inset-0 -m-6 rounded-full wsy-revising-glow" aria-hidden="true" />
                    <Sparkles className="relative w-12 h-12 text-primary wsy-revising" />
                  </div>
                  <p className="text-base font-semibold text-primary wsy-revising">{t('revising')}</p>
                </div>
              )}
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
                  boxShadow: device !== 'desktop' ? '0 10px 40px -12px rgba(0,0,0,0.3)' : 'none',
                  borderRadius: device !== 'desktop' ? 18 : 0,
                }}
              />
            </div>
          </div>

          {/* Aksiyon barı: Onayla / Reddet / Düzenle */}
          {!site ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center animate-card-enter">
              <Sparkles className="w-6 h-6 text-primary/50 mx-auto animate-pulse" />
              <p className="mt-3 text-sm text-gray-500">{t('building')}</p>
            </div>
          ) : !panel ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-gray-900">{t('reviewActionsTitle')}</p>
                <p className="text-sm text-gray-500 mt-0.5">{t('reviewActionsHint')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button onClick={() => { setPanel('reject'); setFeedback('') }} disabled={working} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50">
                  <ThumbsDown className="w-4 h-4" /> {t('reject')}
                </button>
                <button onClick={() => { setPanel('edit'); setFeedback('') }} disabled={working} className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                  <Pencil className="w-4 h-4" /> {t('edit')}
                </button>
                {isPublished ? (
                  <a href={`/s/${site?.subdomain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
                    <ExternalLink className="w-4 h-4" /> {t('viewLive')}
                  </a>
                ) : (
                  <button onClick={approve} disabled={working} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[0.97] transition-all disabled:opacity-50">
                    <Check className="w-4 h-4" /> {busy === 'approve' ? t('publishing') : t('approveAndPublish')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Reddet / Düzenle geri bildirim paneli */
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${panel === 'reject' ? 'bg-gray-100 text-gray-600' : 'bg-primary/10 text-primary'}`}>
                    {panel === 'reject' ? <ThumbsDown className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{panel === 'reject' ? t('rejectTitle') : t('editTitle')}</h3>
                    <p className="text-sm text-gray-500">{panel === 'reject' ? t('rejectHint') : t('editHint')}</p>
                  </div>
                </div>
                <button onClick={() => { setPanel(null); setFeedback('') }} disabled={working} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40" aria-label={t('cancel')}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              {siteLocales.length > 1 && (
                <p className="mt-3 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2.5">{t('revisionAllLocalesHint')}</p>
              )}
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                autoFocus
                placeholder={panel === 'reject' ? t('rejectPlaceholder') : t('editPlaceholder')}
                className="mt-4 w-full rounded-xl border border-gray-200 p-3 text-sm leading-relaxed focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <DictateButton
                  onAppend={(text) => setFeedback((prev) => (prev ? `${prev} ${text}` : text))}
                  lang={uiLocale === 'en' ? 'en-US' : 'tr-TR'}
                  labelStart={t('dictate')}
                  labelStop={t('listening')}
                  labelPause={t('stopDictate')}
                />
                <div className="flex items-center gap-2.5">
                  <button onClick={() => { setPanel(null); setFeedback('') }} disabled={working} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
                    {t('cancel')}
                  </button>
                  <button onClick={() => revise(panel)} disabled={working || !feedback.trim()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white active:scale-[0.97] transition-all disabled:opacity-50">
                    <Send className="w-4 h-4" /> {working ? t('revising') : t('sendRevision')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCredit && (
        <AccessRequiredModal type="credit" featureKey="website_generation" dismissible onClose={() => setShowCredit(false)} reason="website_revision_gate" />
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
