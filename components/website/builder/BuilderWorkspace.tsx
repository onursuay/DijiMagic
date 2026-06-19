'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Sparkles, AlertCircle } from 'lucide-react'
import { ToastContainer, type Toast } from '@/components/Toast'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import DesignPanel from '@/components/website/DesignPanel'
import WizardBuildingAnimation from '@/components/website/WizardBuildingAnimation'
import type { Website, WebsitePage, WebsiteVersionMeta } from '@/lib/website/types'
import { COMPONENTS } from '@/lib/website/codegen/library'
import BuilderTopbar from './BuilderTopbar'
import PreviewCanvas from './PreviewCanvas'
import PageNavigator from './PageNavigator'
import AiChatPanel, { type ChatMessage } from './AiChatPanel'
import RightInspectorPanel from './RightInspectorPanel'
import ManageDrawer from './ManageDrawer'
import RevisePanel from './RevisePanel'
import CreditUsageTimeline from './CreditUsageTimeline'
import PublishPopup from './PublishPopup'
import type { Device } from './DeviceSwitcher'
import type { VisualEditOp, VisualSelection } from './visualEditTypes'

type Busy = 'ai' | 'quick' | 'publish' | 'logo' | 'rollback' | 'reject' | 'edit' | 'approve' | null
type RevisePanelMode = 'reject' | 'edit' | null

const LOCALE_NAMES: Record<string, string> = {
  tr: 'Türkçe', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', ar: 'العربية', it: 'Italiano', ru: 'Русский',
}
const localeName = (l: string) => LOCALE_NAMES[l] ?? l.toUpperCase()

/**
 * #builder-8a — Tam-ekran Builder Workspace (Promake tarzı). Dashboard içine sıkışmış dar iframe
 * KALDIRILDI; bunun yerine: üstte BuilderTopbar, solda AI sohbet paneli (+ sayfa gezgini),
 * ortada BÜYÜK PreviewCanvas, sağda müfettiş (inspector) paneli.
 *
 * `app/tasarim` split-pane istisnası geçerli → max-w-7xl UYGULANMAZ; workspace, modül layout'unun
 * `flex-1 flex flex-col overflow-hidden` konteynerini tamamen doldurur.
 *
 * Mevcut revize / yayınla / onayla / geri-al / logo / build / create-flow akışları AYNEN korunur
 * (eski detay + onizleme sayfalarından buraya taşındı; API/üretim değişmedi).
 */
export default function BuilderWorkspace({ websiteId }: { websiteId: string }) {
  const router = useRouter()
  const search = useSearchParams()
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const tChat = useTranslations('dashboard.webSiteYoneticisi.builder.chat')
  const tCat = useTranslations('dashboard.webSiteYoneticisi.builder.visualEdit')

  // Wizard'dan ?create=ai|quick ile gelindiyse üretim BAŞLAMIŞ kabul edilir (boş-durum flash etmez).
  const [createInitiated, setCreateInitiated] = useState(() => {
    const mode = search.get('create')
    return mode === 'ai' || mode === 'quick'
  })

  const [site, setSite] = useState<Website | null>(null)
  const [pages, setPages] = useState<WebsitePage[]>([])
  const [activeSlug, setActiveSlug] = useState('home')
  const [previewLocale, setPreviewLocale] = useState('tr')
  const [device, setDevice] = useState<Device>('desktop')
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState<Busy>(null)
  const [genError, setGenError] = useState('')
  const [versions, setVersions] = useState<WebsiteVersionMeta[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])

  const [showCredit, setShowCredit] = useState(false)
  const [creditReason, setCreditReason] = useState<'website_generation_gate' | 'website_revision_gate'>('website_generation_gate')
  const [showDesign, setShowDesign] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [openingPreview, setOpeningPreview] = useState(false)

  // Revize paneli (Onayla/Reddet/Düzenle)
  const [panel, setPanel] = useState<RevisePanelMode>(null)
  const [feedback, setFeedback] = useState('')

  // #builder-8b — VISUAL EDIT: tuvalde tıkla-seç ile seçilen blok + patch durumu.
  const [selection, setSelection] = useState<VisualSelection | null>(null)
  const [editBusy, setEditBusy] = useState<VisualEditOp | null>(null)

  // #builder-8c — AI sohbet thread'i + Yayınla popup'ı + markalı önizleme URL'i.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [showPublish, setShowPublish] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreviewUrl, setLoadingPreviewUrl] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const addToast = useCallback((message: string, type: Toast['type']) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, type }])
  }, [])
  const removeToast = useCallback((tid: string) => setToasts((p) => p.filter((x) => x.id !== tid)), [])

  const load = useCallback(async () => {
    if (!websiteId) return
    const [sRes, pRes] = await Promise.all([
      fetch(`/api/website/${websiteId}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/website/${websiteId}/pages`).then((r) => r.json()).catch(() => null),
    ])
    if (sRes?.ok) { setSite(sRes.website); setPreviewLocale(sRes.website.defaultLocale || 'tr') }
    if (pRes?.ok) setPages(pRes.pages ?? [])
  }, [websiteId])

  const fetchVersions = useCallback(async () => {
    if (!websiteId) return
    const res = await fetch(`/api/website/${websiteId}/versions`).then((r) => r.json()).catch(() => null)
    if (res?.ok) setVersions(res.versions ?? [])
  }, [websiteId])

  useEffect(() => { load(); fetchVersions() }, [load, fetchVersions])

  const localePages = pages.filter((p) => p.locale === previewLocale)
  const visiblePages = localePages.length ? localePages : pages
  const activePage = visiblePages.find((p) => p.slug === activeSlug) ?? visiblePages[0] ?? null
  const activeSlugSafe = activePage?.slug ?? 'home'
  const isPublished = site?.status === 'published'
  const hasPages = pages.length > 0
  const siteLocales = site?.locales ?? []
  const liveHref = isPublished && site?.subdomain ? `/s/${site.subdomain}` : undefined
  const working = busy !== null
  const reviseBusy = busy === 'reject' || busy === 'edit' || busy === 'approve' ? busy : null
  const pagePath = activeSlugSafe === 'home' ? '/' : `/${activeSlugSafe}`
  // #builder-8c — sohbet komutu işleniyor mu (input + butonları kilitle); kredi timeline'ı
  // hangi durumlarda canlı yoklasın (üretim/revizyon/blok-edit sürerken).
  const chatBusy = busy === 'edit' || busy === 'reject' || editBusy === 'ai_rewrite'
  const generationActive = busy === 'ai' || busy === 'quick' || busy === 'edit' || busy === 'reject' || editBusy !== null

  // ---- Üretim (build) + create-flow (wizard'dan otomatik başlatma) --------------------------
  const handleAi = async (override?: string) => {
    setBusy('ai'); setGenError('')
    try {
      const res = await fetch(`/api/website/${websiteId}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instructions: override ?? '' }),
      })
      if (res.status === 402) { setCreditReason('website_generation_gate'); setShowCredit(true); return }
      const json = await res.json()
      if (json.ok) { setPages(json.pages ?? []); setActiveSlug('home'); setReloadKey((k) => k + 1); fetchVersions() }
      else { const m = json.error || t('buildError'); setGenError(m); addToast(m, 'error') }
    } catch { setGenError(t('buildError')); addToast(t('buildError'), 'error') } finally { setBusy(null); setCreateInitiated(false) }
  }

  const handleQuick = async () => {
    setBusy('quick'); setGenError('')
    try {
      const res = await fetch(`/api/website/${websiteId}/build`, { method: 'POST' })
      const json = await res.json()
      if (json.ok) { setPages(json.pages ?? []); setActiveSlug('home'); setReloadKey((k) => k + 1); fetchVersions() }
      else { setGenError(t('buildError')); addToast(t('buildError'), 'error') }
    } catch { setGenError(t('buildError')); addToast(t('buildError'), 'error') } finally { setBusy(null); setCreateInitiated(false) }
  }

  const autoStarted = useRef(false)
  useEffect(() => {
    if (autoStarted.current || !site || busy) return
    if (pages.length > 0) { autoStarted.current = true; setCreateInitiated(false); return }
    const mode = search.get('create')
    if (mode === 'ai' || mode === 'quick') {
      autoStarted.current = true
      setCreateInitiated(true)
      router.replace(`/web-site-yoneticisi/${websiteId}`, { scroll: false })
      if (mode === 'ai') void handleAi(site.theme?.initialInstructions ?? '')
      else void handleQuick()
    } else {
      setCreateInitiated(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, pages.length])

  // ---- Revize (reddet / düzenle) — onizleme akışı birebir korunur -----------------------------
  const revise = async (mode: 'reject' | 'edit') => {
    const text = feedback.trim()
    if (mode === 'edit' && !text) return
    setPanel(null)
    setBusy(mode)
    try {
      const res = await fetch(`/api/website/${websiteId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions: text,
          revisionMode: mode,
          ...(mode === 'edit' ? { targetSlug: activeSlugSafe, targetLocale: previewLocale } : {}),
        }),
      })
      if (res.status === 402) { setCreditReason('website_revision_gate'); setShowCredit(true); setPanel(null); setFeedback(''); return }
      const json = await res.json()
      if (json.ok) {
        setPages(json.pages ?? [])
        if (mode !== 'edit') setActiveSlug('home')
        setReloadKey((k) => k + 1)
        setPanel(null)
        setFeedback('')
        fetchVersions()
        addToast(t('revisionDone'), 'success')
      } else {
        setPanel(mode)
        addToast(json.error || t('buildError'), 'error')
      }
    } catch {
      setPanel(mode)
      addToast(t('buildError'), 'error')
    } finally { setBusy(null) }
  }

  // ---- #builder-8b — VISUAL EDIT: cerrahi PATCH dispatcher (full regen YASAK) -------------
  // Tüm görsel düzenleme op'ları tek endpoint'ten geçer: /api/website/<id>/patch.
  // Başarı → setPages + reloadKey (tuval tazelenir, seçim korunur). 402 → kredi modali.
  const dispatchPatch = useCallback(
    async (
      op: VisualEditOp,
      extra: { content?: Record<string, string>; instruction?: string; after?: string } = {},
    ) => {
      if (!selection || editBusy) return
      setEditBusy(op)
      try {
        const res = await fetch(`/api/website/${websiteId}/patch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op,
            targetId: selection.blockId,
            targetSlug: activeSlugSafe,
            targetLocale: previewLocale,
            ...extra,
          }),
        })
        if (res.status === 402) { setCreditReason('website_revision_gate'); setShowCredit(true); return }
        const json = await res.json().catch(() => null)
        if (json?.ok) {
          setPages(json.pages ?? [])
          setReloadKey((k) => k + 1)
          fetchVersions()
          if (op === 'delete') setSelection(null) // silinen blok artık yok
          addToast(t('builder.visualEdit.applied'), 'success')
        } else {
          addToast(json?.error || t('buildError'), 'error')
        }
      } catch {
        addToast(t('buildError'), 'error')
      } finally {
        setEditBusy(null)
      }
    },
    // activeSlugSafe/previewLocale değişkenleri render başında türetilir; bağımlılığa
    // selection + editBusy + websiteId yeterli (slug/locale closure'dan okunur).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, editBusy, websiteId, t, fetchVersions],
  )

  // Move up/down — `order` (runtime'dan gelen blok sırası) ile `after` anchor hesaplanır.
  const moveSelected = useCallback(
    (dir: 'up' | 'down') => {
      if (!selection) return
      const order = selection.order
      const idx = order.indexOf(selection.blockId)
      if (idx === -1) return
      if (dir === 'up') {
        if (idx <= 0) return
        // Önceki bloğun ÖNÜNE taşı = ondan-önceki bloğun ardına (ilk ise en başa).
        const after = idx - 2 >= 0 ? order[idx - 2] : '__start__'
        void dispatchPatch('move', { after })
      } else {
        if (idx >= order.length - 1) return
        // Sonraki bloğun ARDINA taşı.
        void dispatchPatch('move', { after: order[idx + 1] })
      }
    },
    [selection, dispatchPatch],
  )

  const selIdx = selection ? selection.order.indexOf(selection.blockId) : -1
  const canMoveUp = selIdx > 0
  const canMoveDown = selIdx >= 0 && selIdx < (selection?.order.length ?? 0) - 1

  // Tuval seçim olayları → seçimi parent'a al; sayfa/dil değişince seçimi temizle.
  const handleSelect = useCallback((sel: VisualSelection) => setSelection(sel), [])
  useEffect(() => { setSelection(null) }, [activeSlugSafe, previewLocale])

  // ---- #builder-8c — AI SOHBET: seçili blok varsa /patch (ai_rewrite), yoksa /generate revize -----
  // Seçili bloğun sade TR/EN etiketi (sohbet hedef satırı için; ham blockKey ASLA gösterilmez).
  const selectedLabel = (() => {
    if (!selection?.blockKey) return null
    const def = COMPONENTS[selection.blockKey]
    if (!def) return tCat('unknownBlock')
    const label = tCat(`category.${def.category}`)
    return label.startsWith('category.') ? tCat('unknownBlock') : label
  })()

  const pushChat = useCallback((role: ChatMessage['role'], text: string, pending = false) => {
    const id = crypto.randomUUID()
    setChatMessages((prev) => [...prev, { id, role, text, pending }])
    return id
  }, [])
  const settleChat = useCallback((id: string, text: string) => {
    setChatMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text, pending: false } : m)))
  }, [])

  // Sohbet komutu — DÜZENLE modu. Blok seçiliyse cerrahi /patch (ai_rewrite, targetId),
  // değilse sayfa-düzey /generate revize (revisionMode 'edit'). Tek charge yolu korunur.
  const handleChatSubmit = useCallback(
    async (text: string) => {
      if (busy || editBusy) return
      pushChat('user', text)
      const asst = pushChat('assistant', tChat('applying'), true)
      try {
        if (selection) {
          // Hedefli blok düzenleme → mevcut /patch (ai_rewrite).
          setEditBusy('ai_rewrite')
          const res = await fetch(`/api/website/${websiteId}/patch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              op: 'ai_rewrite',
              targetId: selection.blockId,
              targetSlug: activeSlugSafe,
              targetLocale: previewLocale,
              instruction: text,
            }),
          })
          if (res.status === 402) { setCreditReason('website_revision_gate'); setShowCredit(true); settleChat(asst, tChat('needCredit')); return }
          const json = await res.json().catch(() => null)
          if (json?.ok) {
            setPages(json.pages ?? [])
            setReloadKey((k) => k + 1)
            fetchVersions()
            settleChat(asst, tChat('doneBlock', { block: selectedLabel ?? tCat('unknownBlock') }))
          } else {
            settleChat(asst, json?.error || tChat('failed'))
          }
        } else {
          // Sayfa-düzey revize → mevcut /generate (revisionMode 'edit', hedef sayfa+dil).
          setBusy('edit')
          const res = await fetch(`/api/website/${websiteId}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instructions: text, revisionMode: 'edit', targetSlug: activeSlugSafe, targetLocale: previewLocale }),
          })
          if (res.status === 402) { setCreditReason('website_revision_gate'); setShowCredit(true); settleChat(asst, tChat('needCredit')); return }
          const json = await res.json().catch(() => null)
          if (json?.ok) {
            setPages(json.pages ?? [])
            setReloadKey((k) => k + 1)
            fetchVersions()
            settleChat(asst, tChat('donePage'))
          } else {
            settleChat(asst, json?.error || tChat('failed'))
          }
        }
      } catch {
        settleChat(asst, tChat('failed'))
      } finally {
        setEditBusy(null); setBusy(null)
      }
    },
    // Sayfa/dil değişince callback yeniden kurulur → chat her zaman GÜNCEL sayfa+locale'i hedefler.
    [busy, editBusy, websiteId, selection, selectedLabel, activeSlugSafe, previewLocale, pushChat, settleChat, fetchVersions, tChat, tCat],
  )

  // "Baştan üret" (reject) — seçimden bağımsız tüm sayfayı yeniden üretir (/generate revisionMode 'reject').
  const handleChatRegenerate = useCallback(
    async (text: string) => {
      if (busy || editBusy) return
      pushChat('user', text)
      const asst = pushChat('assistant', tChat('regenerating'), true)
      setBusy('reject')
      try {
        const res = await fetch(`/api/website/${websiteId}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instructions: text, revisionMode: 'reject' }),
        })
        if (res.status === 402) { setCreditReason('website_revision_gate'); setShowCredit(true); settleChat(asst, tChat('needCredit')); return }
        const json = await res.json().catch(() => null)
        if (json?.ok) {
          setPages(json.pages ?? [])
          setActiveSlug('home')
          setReloadKey((k) => k + 1)
          fetchVersions()
          settleChat(asst, tChat('doneRegenerate'))
        } else {
          settleChat(asst, json?.error || tChat('failed'))
        }
      } catch {
        settleChat(asst, tChat('failed'))
      } finally {
        setBusy(null)
      }
    },
    // Sayfa/dil değişince callback yeniden kurulur → chat her zaman GÜNCEL sayfa+locale'i hedefler.
    [busy, editBusy, websiteId, activeSlugSafe, previewLocale, pushChat, settleChat, fetchVersions, tChat],
  )

  const approve = async () => {
    setBusy('approve')
    try {
      const res = await fetch(`/api/website/${websiteId}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }),
      })
      const json = await res.json()
      if (json.ok && json.website) { setSite(json.website); setReloadKey((k) => k + 1); addToast(t('publishSuccess'), 'success') }
      else addToast(json.error || t('publishError'), 'error')
    } catch { addToast(t('publishError'), 'error') } finally { setBusy(null) }
  }

  const handleRollback = async (versionId: string) => {
    setBusy('rollback')
    try {
      const res = await fetch(`/api/website/${websiteId}/versions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionId }),
      })
      const json = await res.json()
      if (json.ok) { setPages(json.pages ?? []); setActiveSlug('home'); setReloadKey((k) => k + 1); fetchVersions() }
      else addToast(json.error || t('rollbackError'), 'error')
    } catch { addToast(t('rollbackError'), 'error') } finally { setBusy(null) }
  }

  const handleLogoFile = async (file: File | undefined) => {
    if (!file) return
    setBusy('logo')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/website/${websiteId}/logo`, { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok && json.website) { setSite(json.website); setReloadKey((k) => k + 1) }
      else addToast(json.error || t('logoError'), 'error')
    } catch { addToast(t('logoError'), 'error') } finally { setBusy(null) }
  }

  // #builder-7 — markalı yeni-sekme önizleme (preview-url + window.open) — birebir korunur.
  const openNewTabPreview = async () => {
    if (openingPreview) return
    setOpeningPreview(true)
    const tab = window.open('about:blank', '_blank', 'noopener,noreferrer')
    try {
      const res = await fetch(`/api/website/${websiteId}/preview-url`).then((r) => r.json()).catch(() => null)
      if (res?.ok && res.url) {
        if (tab) tab.location.href = res.url
        else window.open(res.url, '_blank', 'noopener,noreferrer')
      } else { tab?.close(); addToast(t('buildError'), 'error') }
    } catch { tab?.close(); addToast(t('buildError'), 'error') } finally { setOpeningPreview(false) }
  }

  // #builder-8c — Yayınla popup'ını aç + markalı önizleme URL'ini çek (.vercel.app ASLA).
  const openPublishPopup = useCallback(async () => {
    setShowPublish(true)
    if (previewUrl || loadingPreviewUrl) return
    setLoadingPreviewUrl(true)
    try {
      const res = await fetch(`/api/website/${websiteId}/preview-url`).then((r) => r.json()).catch(() => null)
      if (res?.ok && res.url) setPreviewUrl(res.url)
    } catch {
      /* fail-soft — popup yine açılır, URL boş gösterilir */
    } finally {
      setLoadingPreviewUrl(false)
    }
  }, [websiteId, previewUrl, loadingPreviewUrl])

  // Popup'tan yayınla — başarı toast + popup açık kalır (canlı URL görünür).
  const publishFromPopup = async () => {
    setBusy('publish')
    try {
      const res = await fetch(`/api/website/${websiteId}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }),
      })
      const json = await res.json()
      if (json.ok && json.website) { setSite(json.website); setReloadKey((k) => k + 1); addToast(t('publishSuccess'), 'success') }
      else addToast(json.error || t('publishError'), 'error')
    } catch { addToast(t('publishError'), 'error') } finally { setBusy(null) }
  }

  const unpublishFromPopup = async () => {
    setBusy('publish')
    try {
      const res = await fetch(`/api/website/${websiteId}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unpublish' }),
      })
      const json = await res.json()
      if (json.ok && json.website) setSite(json.website)
      else addToast(json.error || t('publishError'), 'error')
    } catch { addToast(t('publishError'), 'error') } finally { setBusy(null) }
  }

  // ESC → tam ekrandan çık
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const showBuilding = busy === 'ai' || busy === 'quick' || (createInitiated && !hasPages && !genError)
  const isRevising = busy === 'reject' || busy === 'edit'

  // ---- Boş / üretiliyor durumu (henüz sayfa yok) — workspace yerine merkez kart ---------------
  if (!hasPages) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center app-content-surface p-6">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 animate-card-enter">
            {showBuilding ? (
              <WizardBuildingAnimation />
            ) : (
              <div className="py-4 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">{t('noPagesTitle')}</h2>
                {genError ? (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {genError}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-gray-600">{t('noPagesDesc')}</p>
                )}
                <button
                  type="button"
                  onClick={() => handleAi(site?.theme?.initialInstructions ?? '')}
                  disabled={working}
                  className="mt-1 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white active:scale-[0.97] transition-all disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4" /> {genError ? t('retry') : t('aiBuild')}
                </button>
              </div>
            )}
          </div>
        </div>
        {showCredit && (
          <AccessRequiredModal type="credit" featureKey="website_generation" dismissible onClose={() => setShowCredit(false)} reason={creditReason} />
        )}
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </>
    )
  }

  // ---- Tam workspace --------------------------------------------------------------------------
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { handleLogoFile(e.target.files?.[0]); e.target.value = '' }}
      />

      <div className={`flex flex-col bg-gray-50 ${fullscreen ? 'fixed inset-0 z-40' : 'flex-1 min-h-0'}`}>
        <BuilderTopbar
          websiteId={websiteId}
          siteLabel={site?.label ?? t('title')}
          subdomain={site?.subdomain}
          pagePath={pagePath}
          device={device}
          onDeviceChange={setDevice}
          onRefresh={() => setReloadKey((k) => k + 1)}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          onOpenPreview={openNewTabPreview}
          openingPreview={openingPreview}
          isPublished={isPublished}
          liveHref={liveHref}
          onManage={() => setShowManage(true)}
          onPublish={openPublishPopup}
          publishing={busy === 'publish'}
          working={working}
        />

        <div className="flex-1 min-h-0 flex">
          {/* SOL — sayfa gezgini + AI sohbet (8c placeholder) */}
          <aside className="hidden lg:flex w-72 shrink-0 flex-col gap-4 border-r border-gray-200 bg-white p-4 overflow-y-auto">
            {/* Dil seçici (çok-dilli site) */}
            {siteLocales.length > 1 && (
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white self-start">
                {siteLocales.map((loc) => (
                  <button
                    key={loc}
                    type="button"
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
            <PageNavigator
              pages={visiblePages}
              previewLocale={previewLocale}
              activeSlug={activeSlugSafe}
              onSelect={setActiveSlug}
            />
            {/* #builder-8c — kredi kullanım zaman çizelgesi (üretim/revizyon sürerken canlı) */}
            <CreditUsageTimeline websiteId={websiteId} active={generationActive} reloadKey={reloadKey} />
            <div className="h-px bg-gray-100" />
            {/* #builder-8c — doğal-dil sohbet ile düzenleme (seçili blok → /patch, yoksa sayfa revize) */}
            <AiChatPanel
              messages={chatMessages}
              onSubmit={handleChatSubmit}
              onRegenerate={handleChatRegenerate}
              busy={chatBusy}
              selectedLabel={selectedLabel}
            />
          </aside>

          {/* ORTA — BÜYÜK canvas + alt aksiyon/revize barı */}
          <main className="flex-1 min-w-0 flex flex-col">
            <PreviewCanvas
              websiteId={websiteId}
              locale={previewLocale}
              slug={activeSlugSafe}
              device={device}
              reloadKey={reloadKey}
              revising={isRevising}
              builder
              selection={selection}
              onSelect={handleSelect}
              busy={editBusy}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onEditContent={() => { /* inspector zaten sağ panelde açık */ }}
              onAiRewrite={() => dispatchPatch('ai_rewrite', { instruction: '' })}
              onDelete={() => dispatchPatch('delete')}
              onMoveUp={() => moveSelected('up')}
              onMoveDown={() => moveSelected('down')}
            />
            <div className="shrink-0 border-t border-gray-200 bg-white p-4">
              <RevisePanel
                panel={panel}
                setPanel={setPanel}
                feedback={feedback}
                setFeedback={setFeedback}
                working={working}
                busy={reviseBusy}
                multiLocale={siteLocales.length > 1}
                isPublished={isPublished}
                liveHref={liveHref}
                onRevise={revise}
                onApprove={approve}
              />
            </div>
          </main>

          {/* SAĞ — müfettiş (#builder-8b — contentFields editörü + AI/sil aksiyonları) */}
          <aside className="hidden xl:flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white p-4 overflow-y-auto">
            <RightInspectorPanel
              selection={selection}
              busy={editBusy}
              onApply={(content) => dispatchPatch('edit', { content })}
              onAiRewrite={(instruction) => dispatchPatch('ai_rewrite', { instruction })}
              onDelete={() => dispatchPatch('delete')}
              onClear={() => setSelection(null)}
            />
          </aside>
        </div>
      </div>

      {/* Yönet drawer'ı */}
      <ManageDrawer
        websiteId={websiteId}
        open={showManage}
        onClose={() => setShowManage(false)}
        onOpenDesign={() => { setShowManage(false); setShowDesign(true) }}
        onLogoClick={() => fileInputRef.current?.click()}
        logoBusy={busy === 'logo'}
        versions={versions}
        onRollback={handleRollback}
        rollbackBusy={busy === 'rollback'}
        working={working}
      />

      {/* #builder-8c — Yayınla popup'ı (markalı URL, .vercel.app ASLA; domain bağlama = Faz 2 stub) */}
      <PublishPopup
        open={showPublish}
        onClose={() => setShowPublish(false)}
        onPublish={publishFromPopup}
        onUnpublish={unpublishFromPopup}
        publishing={busy === 'publish'}
        isPublished={isPublished}
        liveHref={liveHref}
        previewUrl={previewUrl}
        loadingPreview={loadingPreviewUrl}
      />

      {showCredit && (
        <AccessRequiredModal type="credit" featureKey="website_generation" dismissible onClose={() => setShowCredit(false)} reason={creditReason} />
      )}
      {showDesign && site && (
        <DesignPanel
          websiteId={websiteId}
          theme={site.theme}
          previewLocale={previewLocale}
          onClose={() => setShowDesign(false)}
          onSaved={(th) => { setSite((p) => (p ? { ...p, theme: th } : p)); setReloadKey((k) => k + 1) }}
        />
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
