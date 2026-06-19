'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Check, X, Pencil, ThumbsDown, Send, ExternalLink } from 'lucide-react'
import DictateButton from '@/components/website/DictateButton'

type RevisePanelMode = 'reject' | 'edit' | null

interface RevisePanelProps {
  panel: RevisePanelMode
  setPanel: (m: RevisePanelMode) => void
  feedback: string
  setFeedback: (v: string) => void
  working: boolean
  busy: 'reject' | 'edit' | 'approve' | null
  multiLocale: boolean
  isPublished: boolean
  liveHref?: string
  onRevise: (mode: 'reject' | 'edit') => void
  onApprove: () => void
}

/**
 * #builder-8a — Onayla / Reddet / Düzenle aksiyon barı + revize geri-bildirim paneli.
 * Mevcut onizleme sayfasındaki revize/onayla akışı BİREBİR korunur (yalnız tuvalin altına,
 * workspace içine taşındı). 8c'de bu, sol AI-sohbet paneline taşınacak — şimdilik erişilebilir.
 */
export default function RevisePanel({
  panel,
  setPanel,
  feedback,
  setFeedback,
  working,
  busy,
  multiLocale,
  isPublished,
  liveHref,
  onRevise,
  onApprove,
}: RevisePanelProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const uiLocale = useLocale()

  if (!panel) {
    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900">{t('reviewActionsTitle')}</p>
          <p className="text-sm text-gray-500 mt-0.5">{t('reviewActionsHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => { setPanel('reject'); setFeedback('') }}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50"
          >
            <ThumbsDown className="w-4 h-4" /> {t('reject')}
          </button>
          <button
            type="button"
            onClick={() => { setPanel('edit'); setFeedback('') }}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" /> {t('edit')}
          </button>
          {isPublished && liveHref ? (
            <a
              href={liveHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> {t('viewLive')}
            </a>
          ) : (
            <button
              type="button"
              onClick={onApprove}
              disabled={working}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> {busy === 'approve' ? t('publishing') : t('approveAndPublish')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
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
        <button
          type="button"
          onClick={() => { setPanel(null); setFeedback('') }}
          disabled={working}
          className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
          aria-label={t('cancel')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {multiLocale && (
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
          onAppend={(text) => setFeedback(feedback ? `${feedback} ${text}` : text)}
          lang={uiLocale === 'en' ? 'en-US' : 'tr-TR'}
          labelStart={t('dictate')}
          labelStop={t('listening')}
          labelPause={t('stopDictate')}
        />
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => { setPanel(null); setFeedback('') }}
            disabled={working}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => onRevise(panel)}
            disabled={panel === 'reject' ? working : (working || !feedback.trim())}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white active:scale-[0.97] transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> {working ? t('revising') : (panel === 'reject' ? t('rejectAction') : t('sendRevision'))}
          </button>
        </div>
      </div>
    </div>
  )
}
