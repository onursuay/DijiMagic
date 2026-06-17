'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  X, Upload, Sparkles, Instagram, Facebook, Check, Play, Loader2, Trash2, AlertCircle,
} from 'lucide-react'
import FormatTabs from './FormatTabs'
import type {
  SocialFormat, SocialMediaType, MetaTargetAccount, SocialPostWithRelations,
  PostTargetInput, PostMediaInput,
} from '@/lib/social/types'

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
  onSubmit,
  onUploadError,
}: {
  open: boolean
  onClose: () => void
  initialFormat: SocialFormat
  initialDate: Date
  editPost: SocialPostWithRelations | null
  targets: MetaTargetAccount[]
  onSubmit: (payload: ComposerSubmit, editId: string | null) => Promise<boolean>
  onUploadError: () => void
}) {
  const t = useTranslations('dashboard.sosyalmedya.composer')
  const isEdit = Boolean(editPost)

  const [source, setSource] = useState<'upload' | 'tasarim'>('upload')
  const [format, setFormat] = useState<SocialFormat>(initialFormat)
  const [media, setMedia] = useState<SelectedMedia | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Açılışta state'i kur (yeni / düzenleme)
  useEffect(() => {
    if (!open) return
    if (editPost) {
      setFormat(editPost.format)
      setCaption(editPost.caption ?? '')
      const m0 = editPost.media[0]
      setMedia(m0 ? { storagePath: m0.storage_path, publicUrl: m0.public_url, mediaType: m0.media_type } : null)
      setSelected(new Set(editPost.targets.map((x) => targetKey(x.platform, x.page_id, x.ig_user_id))))
      const d = new Date(editPost.scheduled_at)
      setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
    } else {
      setFormat(initialFormat)
      setCaption('')
      setMedia(null)
      setSelected(new Set())
      const d = new Date(initialDate)
      const now = new Date()
      const future = d.getTime() < now.getTime() ? new Date(now.getTime() + 60 * 60 * 1000) : d
      setDate(`${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`)
      setTime(`${pad((future.getHours() + (d.getTime() < now.getTime() ? 0 : 0)) % 24)}:00`)
    }
    setSource('upload')
  }, [open, editPost, initialFormat, initialDate])

  // ESC kapat
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])

  const handleFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/social/media/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok) {
        setMedia({ storagePath: json.data.storagePath, publicUrl: json.data.publicUrl, mediaType: json.data.mediaType })
      } else {
        onUploadError()
      }
    } catch {
      onUploadError()
    } finally {
      setUploading(false)
    }
  }, [onUploadError])

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
  const reelsImageConflict = format === 'reels' && media?.mediaType === 'image'
  const canSubmit =
    !saving && !uploading && media && selected.size > 0 && date && time && !storyFbConflict && !reelsImageConflict

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
    if (!canSubmit || !media) return
    setSaving(true)
    try {
      const local = new Date(`${date}T${time}:00`)
      const payload: ComposerSubmit = {
        format,
        caption: format === 'story' ? null : (caption.trim() || null),
        scheduledAt: local.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
        targets: buildTargets(),
        media: [{ mediaType: media.mediaType, storagePath: media.storagePath, publicUrl: media.publicUrl }],
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
              <FormatTabs value={format} onChange={setFormat} />
            </div>
          )}

          {/* Kaynak */}
          {!isEdit && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{t('source')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSource('upload')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                    source === 'upload' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  {t('sourceUpload')}
                </button>
                <button
                  type="button"
                  disabled
                  title={t('designComingSoon')}
                  className="relative flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-400"
                >
                  <Sparkles className="h-4 w-4" />
                  {t('sourceDesign')}
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500">
                    {t('designComingSoon')}
                  </span>
                </button>
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
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              {media ? (
                <div className="relative overflow-hidden rounded-xl border border-gray-200">
                  {media.mediaType === 'video' ? (
                    <div className="relative aspect-video bg-gray-900">
                      <video src={media.publicUrl} className="h-full w-full object-contain" muted preload="metadata" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Play className="h-8 w-8 fill-white/80 text-white/80" />
                      </span>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media.publicUrl} alt="" className="max-h-56 w-full object-contain bg-gray-50" />
                  )}
                  <button
                    type="button"
                    onClick={() => setMedia(null)}
                    className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
                    aria-label={t('removeMedia')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
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
              )}
              {reelsImageConflict && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" /> {t('reelsNeedsVideo')}
                </p>
              )}
            </div>
          )}

          {/* Hedef hesaplar */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('targets')}</label>
            <p className="mb-2 text-xs text-gray-400">{t('targetsHint')}</p>
            {targets.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-500">{t('noTargets')}</p>
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
