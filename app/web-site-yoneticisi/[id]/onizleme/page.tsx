'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Check, X, Pencil, Monitor, Tablet, Smartphone, ExternalLink, Sparkles, Send, ThumbsDown, MousePointerClick, Type, Wand2, Trash2, ImagePlus, Upload, Search } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { ToastContainer, type Toast } from '@/components/Toast'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import DictateButton from '@/components/website/DictateButton'
import type { Website, WebsitePage } from '@/lib/website/types'

type Device = 'desktop' | 'tablet' | 'mobile'
/** Click-select payload posted by the in-iframe overlay (public/yoai-select.js). */
type Selection = {
  blockId: string
  role: string
  text: string
  rect: { top: number; left: number; width: number; height: number; bottom: number; right: number }
  /** The block contains at least one <img> (offer "Görseli değiştir"). */
  hasImage: boolean
  /** The clicked image (index among the block's images + its current src), if any. */
  image: { index: number; src: string } | null
}
/** Which inline action the edit panel is showing (null = just the action list). */
type EditAction = 'text' | 'ai' | 'delete' | 'image' | null
/** Which image-source picker is open inside the 'image' action ('upload' | 'stock'). */
type ImageMode = 'upload' | 'stock' | null
const DESIGN_W: Record<Device, number> = { desktop: 1280, tablet: 834, mobile: 390 }
// Daha uzun tasarım yüksekliği → "tam ekran" hissi (önizleme görünür alanın çoğunu doldurur).
const DESIGN_H = 960

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
  const search = useSearchParams()
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
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [wrapW, setWrapW] = useState(0)
  // ── Manuel tıkla-seç düzenleme (hafif overlay) ──
  // Detay sayfasındaki "Bölümleri Düzenle" butonu buraya ?edit=1 ile yönlendirir →
  // önizleme düzenleme modu AÇIK başlar (kullanıcı düzenleme özelliğini hemen görür).
  const [editMode, setEditMode] = useState(() => search.get('edit') === '1')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [editAction, setEditAction] = useState<EditAction>(null)
  const [editText, setEditText] = useState('')
  const [patchBusy, setPatchBusy] = useState(false)
  // ── "Görseli değiştir" alt-paneli ──
  const [imageMode, setImageMode] = useState<ImageMode>(null)
  const [stockQuery, setStockQuery] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // ── Edit overlay: listen for 'yoai:select' from the sandboxed preview iframe.
  // SECURITY: only accept a message whose source is OUR iframe's contentWindow and
  // whose payload has the exact expected shape. The iframe stays sandboxed (no
  // allow-same-origin); selection is postMessage-only. Listener active in edit mode.
  useEffect(() => {
    if (!editMode) return
    const onMessage = (e: MessageEvent) => {
      const frame = iframeRef.current
      if (!frame || e.source !== frame.contentWindow) return
      const d = e.data
      if (!d || typeof d !== 'object' || d.type !== 'yoai:select') return
      if (typeof d.blockId !== 'string' || !/^b\d+$/.test(d.blockId)) return
      const rect = d.rect && typeof d.rect === 'object' ? d.rect : { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }
      // Validate the optional image fields' SHAPE (same rigor as blockId): index a
      // small non-negative int, src a string. Anything malformed → no image.
      const hasImage = d.hasImage === true
      let image: { index: number; src: string } | null = null
      if (
        d.image && typeof d.image === 'object' &&
        Number.isInteger(d.image.index) && d.image.index >= 0 && d.image.index < 1000 &&
        typeof d.image.src === 'string'
      ) {
        image = { index: d.image.index, src: d.image.src }
      }
      setSelection({
        blockId: d.blockId,
        role: typeof d.role === 'string' ? d.role : '',
        text: typeof d.text === 'string' ? d.text : '',
        rect,
        hasImage,
        image,
      })
      setEditAction(null)
      setEditText(typeof d.text === 'string' ? d.text : '')
      setImageMode(null)
      setStockQuery('')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [editMode])

  // Leaving edit mode clears any open selection/panel.
  useEffect(() => {
    if (!editMode) { setSelection(null); setEditAction(null); setEditText(''); setImageMode(null); setStockQuery('') }
  }, [editMode])

  const localePages = pages.filter((p) => p.locale === previewLocale)
  const visiblePages = localePages.length ? localePages : pages
  const activePage = visiblePages.find((p) => p.slug === activeSlug) ?? visiblePages[0] ?? null
  const activeSlugSafe = activePage?.slug ?? 'home'
  const siteLocales = site?.locales ?? []
  const isPublished = site?.status === 'published'
  const designW = DESIGN_W[device]
  const scale = wrapW > 0 ? Math.min(1, (wrapW - (device === 'mobile' ? 0 : 32)) / designW) : 1
  const pageLabel = (p: WebsitePage) => (PAGE_LABELS[previewLocale] ?? PAGE_LABELS.en)[p.pageRole] ?? p.slug
  // Sade-TR/EN bölüm etiketi (ham 'hero'/'cta' enum'u UI'da ASLA gösterilmez → i18n'den çevir).
  // Bilinen rol kümesi sabit; bilinmeyen/boş rol → genel "Bölüm" etiketi (ham değer basılmaz).
  const KNOWN_ROLES = new Set(['hero', 'services', 'features', 'stats', 'proof', 'cta', 'contact', 'footer', 'header'])
  const roleLabel = (role: string) => {
    const key = (role || '').trim()
    return KNOWN_ROLES.has(key) ? t(`blockRole.${key}`) : t('blockRole.section')
  }

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
        // 'edit' modunda önizlenen sayfayı (slug + dil) gönder → sunucu blok-bazlı
        // cerrahi patch dener; başarısız olursa tam-üretim fallback'e düşer. 'reject'
        // modu (baştan üret) hedef göndermez → mevcut tam-üretim davranışı korunur.
        body: JSON.stringify({
          instructions: text,
          revisionMode: mode,
          ...(mode === 'edit' ? { targetSlug: activeSlugSafe, targetLocale: previewLocale } : {}),
        }),
      })
      if (res.status === 402) { setShowCredit(true); setPanel(null); setFeedback(''); return }
      const json = await res.json()
      if (json.ok) {
        setPages(json.pages ?? [])
        // 'edit' (cerrahi) → kullanıcı düzenlediği sayfada kalsın; 'reject' (baştan üret) → anasayfaya dön.
        if (mode !== 'edit') setActiveSlug('home')
        setReloadKey((k) => k + 1)
        setPanel(null)
        setFeedback('')
        addToast(t('revisionDone'), 'success')
      } else {
        // Başarısız revize: girilen metni KORU — paneli geri aç ki kullanıcı
        // textarea'daki yazısıyla tekrar deneyebilsin (aksiyon barına düşmesin).
        setPanel(mode)
        addToast(json.error || t('buildError'), 'error')
      }
    } catch {
      setPanel(mode)
      addToast(t('buildError'), 'error')
    } finally { setBusy(null) }
  }

  // Manuel tıkla-seç düzenleme → /patch (blok-patch motoru, tekil ücret, re-gate).
  const applyPatch = async (op: 'edit' | 'ai_rewrite' | 'delete', value: string) => {
    if (!selection || patchBusy) return
    setPatchBusy(true)
    try {
      const res = await fetch(`/api/website/${id}/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op,
          targetId: selection.blockId,
          targetSlug: activeSlugSafe,
          targetLocale: previewLocale,
          ...(op === 'edit' ? { content: value } : {}),
          ...(op === 'ai_rewrite' ? { instruction: value } : {}),
        }),
      })
      if (res.status === 402) { setShowCredit(true); return }
      const json = await res.json().catch(() => null)
      if (json?.ok) {
        if (Array.isArray(json.pages)) setPages(json.pages)
        setSelection(null)
        setEditAction(null)
        setEditText('')
        setReloadKey((k) => k + 1)
        addToast(t('revisionDone'), 'success')
      } else {
        addToast(json?.error || t('buildError'), 'error')
      }
    } catch {
      addToast(t('buildError'), 'error')
    } finally { setPatchBusy(false) }
  }

  // Send the deterministic replace_image patch (newUrl = stored upload or stock URL).
  const sendReplaceImage = async (newUrl: string) => {
    if (!selection) return
    // The clicked image's index, or 0 when the block has images but a non-image was
    // clicked (default to the first image).
    const imageIndex = selection.image ? selection.image.index : 0
    const res = await fetch(`/api/website/${id}/patch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'replace_image',
        targetId: selection.blockId,
        imageIndex,
        newUrl,
        targetSlug: activeSlugSafe,
        targetLocale: previewLocale,
      }),
    })
    if (res.status === 402) { setShowCredit(true); return }
    const json = await res.json().catch(() => null)
    if (json?.ok) {
      if (Array.isArray(json.pages)) setPages(json.pages)
      setSelection(null)
      setEditAction(null)
      setImageMode(null)
      setStockQuery('')
      setReloadKey((k) => k + 1)
      addToast(t('revisionDone'), 'success')
    } else {
      addToast(json?.error || t('buildError'), 'error')
    }
  }

  // "Yükle" → upload an image file → stored https URL → replace_image patch.
  const onUploadFile = async (file: File | null) => {
    if (!file || !selection || imageBusy) return
    setImageBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const up = await fetch(`/api/website/${id}/assets`, { method: 'POST', body: fd })
      const upJson = await up.json().catch(() => null)
      if (!upJson?.ok || typeof upJson.url !== 'string') {
        addToast(upJson?.error || t('imageUploadError'), 'error')
        return
      }
      await sendReplaceImage(upJson.url)
    } catch {
      addToast(t('imageUploadError'), 'error')
    } finally {
      setImageBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // "Açıklama ile bul" → fetch ONE stock image for the query → replace_image patch.
  const onStockSearch = async () => {
    const q = stockQuery.trim()
    if (!q || !selection || imageBusy) return
    setImageBusy(true)
    try {
      const sr = await fetch(`/api/website/${id}/stock-image?q=${encodeURIComponent(q)}`)
      const srJson = await sr.json().catch(() => null)
      if (!srJson?.ok || typeof srJson.url !== 'string') {
        addToast(srJson?.error || t('imageStockError'), 'error')
        return
      }
      await sendReplaceImage(srJson.url)
    } catch {
      addToast(t('imageStockError'), 'error')
    } finally {
      setImageBusy(false)
    }
  }

  const approve = async () => {
    setBusy('approve')
    try {
      const res = await fetch(`/api/website/${id}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }),
      })
      const json = await res.json()
      if (json.ok && json.website) {
        setSite(json.website)
        // Yayın sonrası önizlemeyi de tazele (durum/içerik güncel görünsün).
        setReloadKey((k) => k + 1)
        addToast(t('publishSuccess'), 'success')
      } else addToast(json.error || t('publishError'), 'error')
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
            <button
              onClick={() => setEditMode((v) => !v)}
              disabled={working || !site}
              aria-pressed={editMode}
              className={`ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50 ${
                editMode
                  ? 'bg-primary text-white shadow-sm ring-2 ring-primary/20'
                  : 'border border-primary/40 bg-primary/10 text-primary shadow-sm hover:bg-primary/15'
              }`}
            >
              {editMode ? <Check className="w-4 h-4" /> : <MousePointerClick className="w-4 h-4" />}
              {editMode ? t('editModeOn') : t('editSections')}
            </button>
            <a
              href={`/website-preview/${id}?locale=${previewLocale}&slug=${activeSlugSafe}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> {t('openInNewTab')}
            </a>
            <div className="inline-flex items-center rounded-lg border border-gray-200 p-0.5 bg-white">
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
              <span className="ml-2 text-xs text-gray-500 truncate">{site?.subdomain}</span>
              {isPublished && <span className="ml-auto inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5">{t('statusPublished')}</span>}
            </div>
            <div ref={frameWrapRef} className="relative bg-gray-100 flex justify-center overflow-hidden" style={{ height: DESIGN_H * scale }}>
              {working && busy !== 'approve' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/75 backdrop-blur-sm gap-4">
                  <div className="relative flex items-center justify-center">
                    <span className="absolute inset-0 -m-9 rounded-full wsy-revising-glow" aria-hidden="true" />
                    <Sparkles strokeWidth={1.25} className="relative w-[4.5rem] h-[4.5rem] text-primary wsy-revising" />
                  </div>
                  <p className="text-2xl font-light text-primary wsy-revising">{t('revising')}</p>
                </div>
              )}
              <iframe
                ref={iframeRef}
                key={`${previewLocale}-${activeSlugSafe}-${reloadKey}-${editMode ? 'e' : 'n'}`}
                // editMode → ?edit=1 inlines the click-select overlay (preview only).
                // sandbox stays allow-scripts allow-forms (NO allow-same-origin).
                src={`/website-preview/${id}?locale=${previewLocale}&slug=${activeSlugSafe}${editMode ? '&edit=1' : ''}`}
                sandbox="allow-scripts allow-forms"
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
              {editMode && !selection && !working && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary/90 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm">
                    <MousePointerClick className="w-3.5 h-3.5" /> {t('editModeHint')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Manuel düzenleme paneli — seçili bloğun kompakt aksiyon kartı */}
          {editMode && selection && (
            <div className="rounded-xl border border-primary/20 bg-white p-4 shadow-sm animate-card-enter">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Pencil className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate">{t('selectedBlock', { role: roleLabel(selection.role) })}</h3>
                    {selection.text && <p className="text-sm text-gray-500 truncate">{selection.text}</p>}
                  </div>
                </div>
                <button onClick={() => { setSelection(null); setEditAction(null); setImageMode(null); setStockQuery('') }} disabled={patchBusy || imageBusy} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40" aria-label={t('cancel')}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editAction === null && (
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button onClick={() => { setEditAction('text'); setEditText(selection.text) }} disabled={patchBusy} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50">
                    <Type className="w-4 h-4" /> {t('editTextAction')}
                  </button>
                  <button onClick={() => { setEditAction('ai'); setEditText('') }} disabled={patchBusy} className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                    <Wand2 className="w-4 h-4" /> {t('aiRewriteAction')}
                  </button>
                  {selection.hasImage && (
                    <button onClick={() => { setEditAction('image'); setImageMode(null); setStockQuery('') }} disabled={patchBusy} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50">
                      <ImagePlus className="w-4 h-4" /> {t('replaceImageAction')}
                    </button>
                  )}
                  <button onClick={() => setEditAction('delete')} disabled={patchBusy} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /> {t('deleteBlockAction')}
                  </button>
                </div>
              )}

              {(editAction === 'text' || editAction === 'ai') && (
                <div className="mt-4">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={editAction === 'text' ? 4 : 3}
                    autoFocus
                    placeholder={editAction === 'text' ? t('editTextPlaceholder') : t('aiRewritePlaceholder')}
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm leading-relaxed focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  />
                  <div className="mt-3 flex items-center justify-end gap-2.5">
                    <button onClick={() => setEditAction(null)} disabled={patchBusy} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
                      {t('cancel')}
                    </button>
                    <button
                      onClick={() => applyPatch(editAction === 'text' ? 'edit' : 'ai_rewrite', editText.trim())}
                      disabled={patchBusy || !editText.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white active:scale-[0.97] transition-all disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" /> {patchBusy ? t('revising') : t('applyEdit')}
                    </button>
                  </div>
                </div>
              )}

              {editAction === 'delete' && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5">
                  <p className="text-sm text-red-700">{t('deleteBlockConfirm')}</p>
                  <div className="mt-3 flex items-center justify-end gap-2.5">
                    <button onClick={() => setEditAction(null)} disabled={patchBusy} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
                      {t('cancel')}
                    </button>
                    <button onClick={() => applyPatch('delete', '')} disabled={patchBusy} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white active:scale-[0.97] transition-all disabled:opacity-50">
                      <Trash2 className="w-4 h-4" /> {patchBusy ? t('revising') : t('deleteBlockAction')}
                    </button>
                  </div>
                </div>
              )}

              {/* "Görseli değiştir" — kompakt alt-panel: Yükle veya Açıklama ile bul */}
              {editAction === 'image' && (
                <div className="mt-4">
                  {imageMode === null && (
                    <div className="flex flex-wrap gap-2.5">
                      <button onClick={() => fileInputRef.current?.click()} disabled={imageBusy} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50">
                        <Upload className="w-4 h-4" /> {imageBusy ? t('imageWorking') : t('imageUploadOption')}
                      </button>
                      <button onClick={() => setImageMode('stock')} disabled={imageBusy} className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                        <Search className="w-4 h-4" /> {t('imageStockOption')}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => onUploadFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  )}

                  {imageMode === 'stock' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <input
                        type="text"
                        value={stockQuery}
                        onChange={(e) => setStockQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && stockQuery.trim() && !imageBusy) onStockSearch() }}
                        autoFocus
                        placeholder={t('imageStockPlaceholder')}
                        className="flex-1 rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <button onClick={onStockSearch} disabled={imageBusy || !stockQuery.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white active:scale-[0.97] transition-all disabled:opacity-50">
                        <Search className="w-4 h-4" /> {imageBusy ? t('imageWorking') : t('imageStockSearch')}
                      </button>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-end">
                    <button
                      onClick={() => { if (imageMode) setImageMode(null); else setEditAction(null) }}
                      disabled={imageBusy}
                      className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      {imageMode ? t('back') : t('cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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
                  <button onClick={() => revise(panel)} disabled={panel === 'reject' ? working : (working || !feedback.trim())} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white active:scale-[0.97] transition-all disabled:opacity-50">
                    <Send className="w-4 h-4" /> {working ? t('revising') : (panel === 'reject' ? t('rejectAction') : t('sendRevision'))}
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
