'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
  X, Upload, Sparkles, Instagram, Facebook, Check, Play, Loader2, Trash2, AlertCircle, ArrowRight, Link2Off, Plus, FolderOpen,
} from 'lucide-react'
import { localePath } from '@/lib/routes'
import { COST_PER_GENERATION } from '@/lib/subscription/types'
import FormatTabs from './FormatTabs'
import type {
  SocialFormat, SocialMediaType, MetaTargetAccount, SocialPostWithRelations,
  PostTargetInput, PostMediaInput,
} from '@/lib/social/types'

const MAX_CAROUSEL = 10
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024 // 200MB (doğrudan Storage'a; Vercel gövde limiti uygulanmaz)

interface ComposerSubmit {
  format: SocialFormat
  caption: string | null
  scheduledAt: string
  timezone: string
  targets: PostTargetInput[]
  media: PostMediaInput[]
}

interface SelectedMedia {
  storagePath: string
  publicUrl: string
  mediaType: SocialMediaType
}

function targetKey(platform: string, pageId: string, igUserId?: string | null) {
  return `${platform}:${pageId}:${igUserId ?? ''}`
}

function pad(n: number) { return String(n).padStart(2, '0') }

export default function PostComposerModal({
  open,
  onClose,
  initialFormat,
  initialDate,
  editPost,
  targets,
  metaConnected = true,
  bestHour = null,
  onSubmit,
  onUploadError,
  onGenerateError,
}: {
  open: boolean
  onClose: () => void
  initialFormat: SocialFormat
  initialDate: Date
  editPost: SocialPostWithRelations | null
  targets: MetaTargetAccount[]
  metaConnected?: boolean
  bestHour?: number | null
  onSubmit: (payload: ComposerSubmit, editId: string | null) => Promise<boolean>
  onUploadError: () => void
  onGenerateError?: (msg?: string) => void
}) {
  const t = useTranslations('dashboard.sosyalmedya.composer')
  const tA = useTranslations('dashboard.sosyalmedya.analytics')
  const locale = useLocale()
  const router = useRouter()
  const isEdit = Boolean(editPost)

  const [source, setSource] = useState<'upload' | 'ai' | 'library'>('upload')
  const [format, setFormat] = useState<SocialFormat>(initialFormat)
  const [mediaList, setMediaList] = useState<SelectedMedia[]>([])
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiKind, setAiKind] = useState<SocialMediaType>('image')
  const [generating, setGenerating] = useState(false)
  const [library, setLibrary] = useState<{ url: string; type: SocialMediaType }[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Tasarım kütüphanesini (localStorage) oku.
  useEffect(() => {
    if (!open) return
    try {
      const raw = localStorage.getItem('yoai-tasarim-library')
      const arr = raw ? JSON.parse(raw) : []
      setLibrary(
        Array.isArray(arr)
          ? arr.map((x: any) => ({ url: x?.url, type: (x?.type === 'video' ? 'video' : 'image') as SocialMediaType })).filter((x: any) => typeof x.url === 'string')
          : [],
      )
    } catch { setLibrary([]) }
  }, [open])

  // Açılışta state'i kur (yeni / düzenleme)
  useEffect(() => {
    if (!open) return
    if (editPost) {
      setFormat(editPost.format)
      setCaption(editPost.caption ?? '')
      setMediaList(editPost.media.map((m) => ({ storagePath: m.storage_path, publicUrl: m.public_url, mediaType: m.media_type })))
      setSelected(new Set(editPost.targets.map((x) => targetKey(x.platform, x.page_id, x.ig_user_id))))
      const d = new Date(editPost.scheduled_at)
      setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
    } else {
      setFormat(initialFormat)
      setCaption('')
      setMediaList([])
      setSelected(new Set())
      const d = new Date(initialDate)
      const now = new Date()
      const future = d.getTime() < now.getTime() ? new Date(now.getTime() + 60 * 60 * 1000) : d
      setDate(`${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`)
      setTime(`${pad(future.getHours())}:00`)
    }
    setSource('upload')
    setAiPrompt('')
    setAiKind(initialFormat === 'reels' ? 'video' : 'image')
    setGenerating(false)
  }, [open, editPost, initialFormat, initialDate])

  // ESC kapat
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])

  const addMedia = useCallback((m: SelectedMedia) => {
    // feed → carousel (en çok 10); diğer biçimler tek medya (değiştir).
    setMediaList((prev) => (format === 'feed' ? [...prev, m].slice(0, MAX_CAROUSEL) : [m]))
  }, [format])

  const removeMedia = (index: number) => {
    setMediaList((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFiles = useCallback(async (files: FileList) => {
    setUploading(true)
    try {
      const slots = format === 'feed' ? MAX_CAROUSEL - mediaList.length : 1
      const toUpload = Array.from(files).slice(0, Math.max(1, slots))
      for (const file of toUpload) {
        if (file.size > MAX_UPLOAD_BYTES) { onUploadError(); break }
        // 1) imzalı yükleme URL'i al
        const signRes = await fetch('/api/social/media/sign-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentType: file.type }),
        })
        const sign = await signRes.json()
        if (!sign.ok) { onUploadError(); break }
        // 2) dosyayı DOĞRUDAN Storage'a yükle (Vercel ~4.5MB gövde limiti bypass)
        const putRes = await fetch(sign.data.signedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'content-type': file.type },
        })
        if (!putRes.ok) { onUploadError(); break }
        addMedia({ storagePath: sign.data.storagePath, publicUrl: sign.data.publicUrl, mediaType: sign.data.mediaType })
      }
    } catch {
      onUploadError()
    } finally {
      setUploading(false)
    }
  }, [format, mediaList.length, addMedia, onUploadError])

  const generate = useCallback(async () => {
    const p = aiPrompt.trim()
    if (!p || generating) return
    setGenerating(true)
    try {
      const kind: SocialMediaType = format === 'reels' ? 'video' : aiKind
      const aspectRatio = format === 'feed' ? '1:1' : '9:16'
      const res = await fetch('/api/social/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, prompt: p, aspectRatio }),
      })
      const json = await res.json()
      if (json.ok) {
        addMedia({ storagePath: json.data.storagePath, publicUrl: json.data.publicUrl, mediaType: json.data.mediaType })
        setAiPrompt('')
      } else {
        onGenerateError?.(json.message)
      }
    } catch {
      onGenerateError?.()
    } finally {
      setGenerating(false)
    }
  }, [aiPrompt, aiKind, format, generating, addMedia, onGenerateError])

  const importFromLibrary = useCallback(async (item: { url: string; type: SocialMediaType }) => {
    if (importing) return
    setImporting(true)
    try {
      const res = await fetch('/api/social/media/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl: item.url, mediaType: item.type }),
      })
      const json = await res.json()
      if (json.ok) addMedia({ storagePath: json.data.storagePath, publicUrl: json.data.publicUrl, mediaType: json.data.mediaType })
      else onUploadError()
    } catch {
      onUploadError()
    } finally {
      setImporting(false)
    }
  }, [importing, addMedia, onUploadError])

  const changeFormat = (f: SocialFormat) => {
    setFormat(f)
    if (f !== 'feed') setMediaList((prev) => prev.slice(0, 1))
    if (f === 'reels') setAiKind('video')
  }

  if (!open) return null

  const toggleTarget = (platform: 'instagram' | 'facebook', pageId: string, igUserId?: string | null) => {
    const k = targetKey(platform, pageId, igUserId)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const storyFbConflict = format === 'story' && Array.from(selected).some((k) => k.startsWith('facebook:'))
  const reelsImageConflict = format === 'reels' && mediaList[0]?.mediaType === 'image'
  // Edit modunda yalnız caption/tarih güncellenir (API media/target değiştirmez); bu
  // yüzden submit koşulu edit'te medya/hedef/çakışmadan bağımsız.
  const canSubmit = isEdit
    ? !saving && !!date && !!time
    : !saving && !uploading && mediaList.length > 0 && selected.size > 0 && !!date && !!time && !storyFbConflict && !reelsImageConflict

  const canAddMore = format === 'feed' ? mediaList.length < MAX_CAROUSEL : mediaList.length === 0

  const buildTargets = (): PostTargetInput[] => {
    const out: PostTargetInput[] = []
    for (const acc of targets) {
      const fbKey = targetKey('facebook', acc.pageId)
      if (selected.has(fbKey)) out.push({ platform: 'facebook', pageId: acc.pageId, accountLabel: acc.pageName })
      if (acc.instagram) {
        const igKey = targetKey('instagram', acc.pageId, acc.instagram.igUserId)
        if (selected.has(igKey)) {
          out.push({
            platform: 'instagram', pageId: acc.pageId, igUserId: acc.instagram.igUserId,
            accountLabel: `@${acc.instagram.username}`,
          })
        }
      }
    }
    return out
  }

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const local = new Date(`${date}T${time}:00`)
      const payload: ComposerSubmit = {
        format,
        caption: format === 'story' ? null : (caption.trim() || null),
        scheduledAt: local.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
        targets: buildTargets(),
        media: mediaList.map((m) => ({ mediaType: m.mediaType, storagePath: m.storagePath, publicUrl: m.publicUrl })),
      }
      const ok = await onSubmit(payload, editPost?.id ?? null)
      if (ok) onClose()
    } finally {
      setSaving(false)
    }
  }

  const acceptByFormat = format === 'reels' ? 'video/mp4,video/quicktime' : 'image/*,video/mp4,video/quicktime'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{isEdit ? t('editTitle') : t('newTitle')}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Format */}
          {!isEdit && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{t('format')}</label>
              <FormatTabs value={format} onChange={changeFormat} />
            </div>
          )}

          {/* Kaynak */}
          {!isEdit && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{t('source')}</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'upload' as const, Icon: Upload, label: t('sourceUpload') },
                  { id: 'ai' as const, Icon: Sparkles, label: t('sourceAi') },
                  { id: 'library' as const, Icon: FolderOpen, label: t('sourceLibrary') },
                ]).map(({ id, Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSource(id)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition-all ${
                      source === id ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Medya */}
          {!isEdit && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept={acceptByFormat}
                multiple={format === 'feed'}
                className="hidden"
                onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }}
              />

              {/* Seçili medya(lar) */}
              {mediaList.length > 0 && (
                <div className={mediaList.length > 1 ? 'mb-3 grid grid-cols-3 gap-2' : 'mb-3'}>
                  {mediaList.map((m, i) => (
                    <div
                      key={`${m.storagePath}-${i}`}
                      className={`group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 ${mediaList.length > 1 ? 'aspect-square' : ''}`}
                    >
                      {m.mediaType === 'video' ? (
                        <div className={`relative ${mediaList.length > 1 ? 'h-full' : 'aspect-video bg-gray-900'}`}>
                          <video src={m.publicUrl} className="h-full w-full object-cover" muted preload="metadata" />
                          <span className="absolute inset-0 flex items-center justify-center">
                            <Play className="h-6 w-6 fill-white/80 text-white/80" />
                          </span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.publicUrl} alt="" className={mediaList.length > 1 ? 'h-full w-full object-cover' : 'max-h-56 w-full object-contain'} />
                      )}
                      {mediaList.length > 1 && (
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white">{i + 1}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(i)}
                        className="absolute right-1.5 top-1.5 rounded-lg bg-black/50 p-1 text-white transition-colors hover:bg-black/70"
                        aria-label={t('removeMedia')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {/* Carousel'e ekle butonu (feed, upload) */}
                  {format === 'feed' && canAddMore && source === 'upload' && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                    </button>
                  )}
                </div>
              )}

              {/* Ekleme alanı (boşken veya AI/kütüphane ile çoğaltırken) */}
              {canAddMore && (source !== 'upload' || mediaList.length === 0) && (
                source === 'upload' ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-10 text-center transition-colors hover:border-primary/40 hover:bg-gray-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm text-gray-500">{t('uploading')}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-gray-400" />
                        <span className="text-sm text-gray-500">{t('uploadHint')}</span>
                        <span className="text-xs font-medium text-primary">{t('uploadButton')}</span>
                      </>
                    )}
                  </button>
                ) : source === 'ai' ? (
                  <div className="space-y-3 rounded-xl border border-gray-200 p-4">
                    {format !== 'reels' && (
                      <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
                        {(['image', 'video'] as const).map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setAiKind(k)}
                            className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${
                              aiKind === k ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {k === 'image' ? t('aiKindImage') : t('aiKindVideo')}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={3}
                      placeholder={t('aiPromptPlaceholder')}
                      className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-400">{t('generateCost', { count: COST_PER_GENERATION })}</span>
                      <button
                        type="button"
                        onClick={generate}
                        disabled={!aiPrompt.trim() || generating}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {generating ? t('generating') : t('generate')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 p-3">
                    {library.length === 0 ? (
                      <p className="py-6 text-center text-sm text-gray-500">{t('libraryEmpty')}</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {library.slice(0, 12).map((item, i) => (
                          <button
                            key={i}
                            type="button"
                            disabled={importing}
                            onClick={() => importFromLibrary(item)}
                            className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 transition-colors hover:border-primary/40 disabled:opacity-60"
                          >
                            {item.type === 'video' ? (
                              <video src={item.url} className="h-full w-full object-cover" muted preload="metadata" />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.url} alt="" className="h-full w-full object-cover" />
                            )}
                            {importing && (
                              <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}

              {reelsImageConflict && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" /> {t('reelsNeedsVideo')}
                </p>
              )}
              {format === 'feed' && mediaList.length > 1 && (
                <p className="mt-1.5 text-xs text-gray-400">{t('carouselHint', { count: mediaList.length })}</p>
              )}
            </div>
          )}

          {/* Hedef hesaplar (edit'te API targets güncellemediği için gizli) */}
          {!isEdit && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('targets')}</label>
            <p className="mb-2 text-xs text-gray-400">{t('targetsHint')}</p>
            {targets.length === 0 ? (
              !metaConnected ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-center">
                  <Link2Off className="mx-auto mb-2 h-6 w-6 text-gray-400" />
                  <p className="text-sm text-gray-600">{t('notConnected')}</p>
                  <button
                    type="button"
                    onClick={() => router.push(localePath('/entegrasyon', locale))}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white transition-all hover:bg-primary/90 active:scale-[0.97]"
                  >
                    {t('goToIntegration')}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-500">{t('noTargets')}</p>
              )
            ) : (
              <div className="space-y-1.5">
                {targets.map((acc) => {
                  const fbSelected = selected.has(targetKey('facebook', acc.pageId))
                  const fbDisabled = format === 'story'
                  const igSelected = acc.instagram ? selected.has(targetKey('instagram', acc.pageId, acc.instagram.igUserId)) : false
                  return (
                    <div key={acc.pageId} className="rounded-xl border border-gray-200 p-2">
                      {acc.instagram && (
                        <button
                          type="button"
                          onClick={() => toggleTarget('instagram', acc.pageId, acc.instagram!.igUserId)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                            igSelected ? 'bg-primary/5' : 'hover:bg-gray-50'
                          }`}
                        >
                          <Instagram className="h-4 w-4 text-gray-500" />
                          <span className="flex-1 text-sm text-gray-800">@{acc.instagram.username}</span>
                          <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${igSelected ? 'border-primary bg-primary text-white' : 'border-gray-300'}`}>
                            {igSelected && <Check className="h-3 w-3" />}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={fbDisabled}
                        onClick={() => toggleTarget('facebook', acc.pageId)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                          fbDisabled ? 'cursor-not-allowed opacity-40' : fbSelected ? 'bg-primary/5' : 'hover:bg-gray-50'
                        }`}
                      >
                        <Facebook className="h-4 w-4 text-gray-500" />
                        <span className="flex-1 text-sm text-gray-800">{acc.pageName}</span>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${fbSelected ? 'border-primary bg-primary text-white' : 'border-gray-300'}`}>
                          {fbSelected && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {storyFbConflict && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5" /> {t('fbNoStory')}
              </p>
            )}
          </div>
          )}

          {/* Caption */}
          {format !== 'story' ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{t('caption')}</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                placeholder={t('captionPlaceholder')}
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          ) : (
            <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-500">{t('storyNoCaption')}</p>
          )}

          {/* Tarih + Saat */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">{t('scheduleAt')}</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {!isEdit && bestHour != null && (
              <button
                type="button"
                onClick={() => setTime(`${pad(bestHour)}:00`)}
                className="mt-2 text-xs font-medium text-primary transition-colors hover:underline"
              >
                {tA('suggestedTime', { hour: bestHour })} · {tA('useSuggested')}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? t('saveChanges') : t('schedule')}
          </button>
        </div>
      </div>
    </div>
  )
}
