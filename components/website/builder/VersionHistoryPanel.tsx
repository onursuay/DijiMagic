'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { History, RotateCcw, Loader2, AlertCircle } from 'lucide-react'
import type { WebsiteVersionMeta } from '@/lib/website/types'

interface VersionHistoryPanelProps {
  versions: WebsiteVersionMeta[]
  /** Geri-al isteği sürerken butonları kilitler. */
  rollbackBusy: boolean
  /** Herhangi bir AI/yayın işlemi sürerken de kilitlenir. */
  working: boolean
  onRollback: (versionId: string) => void
}

/**
 * #builder-8c — Sürüm geçmişi + geri-al paneli. `GET /versions` listesini (sebep + zaman)
 * gösterir; her geçmiş sürümün "Geri Al" butonu ONAY ister (yanlışlıkla geri-alma yok),
 * onaylanınca rollback route'u çağrılır (kredi düşmez) ve tuval tazelenir (parent reloadKey).
 *
 * Modal/drawer içinde kullanılır → animate-card-enter EKLENMEZ (kendi açılış animasyonu var).
 * Amber/sarı YASAK. En yeni sürüm = aktif (yeşil nokta), geri-al yok.
 */
export default function VersionHistoryPanel({ versions, rollbackBusy, working, onRollback }: VersionHistoryPanelProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const uiLocale = useLocale()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (versions.length === 0) return null

  const reasonLabel = (r: string) =>
    r === 'revision' ? t('reasonRevision') : r === 'rollback' ? t('reasonRollback') : t('reasonInitial')
  const fmtDate = (s: string) => {
    try {
      return new Date(s).toLocaleString(uiLocale === 'en' ? 'en-US' : 'tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return s
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <History className="w-4 h-4 text-gray-500" />
        <span className="text-base font-medium text-gray-700">{t('historyTitle')}</span>
        <span className="text-caption text-gray-400">({versions.length})</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {versions.map((v, i) => {
          const isCurrent = i === 0
          const isConfirming = confirmId === v.id
          return (
            <li key={v.id} className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-caption px-2 py-0.5">
                  {reasonLabel(v.reason)}
                </span>
                <span className="text-caption text-gray-500">{fmtDate(v.createdAt)}</span>
                {isCurrent ? (
                  <span className="ml-auto inline-flex items-center gap-1.5 text-caption text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {t('currentVersion')}
                  </span>
                ) : !isConfirming ? (
                  <button
                    type="button"
                    onClick={() => setConfirmId(v.id)}
                    disabled={working}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-caption font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('rollback')}
                  </button>
                ) : (
                  <span className="ml-auto" />
                )}
              </div>

              {/* Geri-al onay satırı (inline confirm — yanlışlıkla geri-alma yok) */}
              {isConfirming && (
                <div className="mt-2.5 flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="flex items-start gap-2 text-sm leading-relaxed text-gray-700">
                    <AlertCircle className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                    {t('builder.versionHistory.confirmRollback')}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      disabled={rollbackBusy}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { onRollback(v.id); setConfirmId(null) }}
                      disabled={rollbackBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-white active:scale-[0.97] transition-all disabled:opacity-50"
                    >
                      {rollbackBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      {rollbackBusy ? t('rollingBack') : t('builder.versionHistory.confirmAction')}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
