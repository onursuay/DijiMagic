'use client'

/* Duruma göre kart footer butonları (Faz 3):
   pending          → Onayla + Reddet
   approved (ad)     → Yayınla + Reddet   (Yayınla → sihirbaz)
   approved (advisory)→ Uygulandı İşaretle + Reddet
   applied           → Reddet (yayınlanan reklamı durdurma niyeti — soft)
   rejected_by_user  → gri + "Geri Al"
*/

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import type { HierStatus } from '@/lib/yoai/ai/hierarchicalStore'

interface Props {
  kind: 'ad' | 'advisory'
  status: HierStatus
  busy?: boolean
  publishError?: string | null
  /** true → alt köşe yuvarlatma + mt-auto kaldırılır (başka bir satırın üstüne yerleşince). */
  flush?: boolean
  /** true → kompakt footer: py-2 + normal case + text-[12px] (ad set kartı gibi dar bağlamlar). */
  compact?: boolean
  onApprove: () => void          // pending "Onayla"
  onPublishOrApply: () => void   // approved birincil aksiyon (ad: Yayınla, advisory: Uygulandı)
  onReject: () => void
  onUndo: () => void
}

export default function HierCardActions({ kind, status, busy, publishError, flush, compact, onApprove, onPublishOrApply, onReject, onUndo }: Props) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  const [confirmReject, setConfirmReject] = useState(false)
  const roundB = flush ? '' : 'rounded-b-2xl'
  // Kompakt: dengeli, sade footer (büyük uppercase ~48px satır yerine).
  const btn = compact
    ? 'py-2 font-semibold text-[12px] transition-colors disabled:opacity-40'
    : 'py-3 font-bold text-[12px] tracking-wider uppercase transition-colors disabled:opacity-40'

  const confBtn = compact ? 'py-2 font-semibold text-[12px]' : 'py-2.5 font-bold text-[12px] tracking-wider uppercase'
  const rejectConfirmBlock = (
    <div className="bg-red-950/20">
      <p className={`text-[12px] text-red-300 text-center px-3 font-medium ${compact ? 'py-2' : 'py-2.5'}`}>{t('rejectConfirm')}</p>
      <div className={`flex overflow-hidden ${roundB} border-t border-red-500/20`}>
        <button onClick={onReject} disabled={busy} className={`flex-1 ${confBtn} bg-red-600 hover:bg-red-500 text-white disabled:opacity-40`}>
          {busy ? '…' : t('rejectYes')}
        </button>
        <button onClick={() => setConfirmReject(false)} disabled={busy} style={{ clipPath: 'polygon(16px 0%, 100% 0%, 100% 100%, 0% 100%)', marginLeft: '-16px' }} className={`flex-1 ${compact ? 'py-2 text-[12px] font-semibold' : 'py-2.5 text-[12px] tracking-wider uppercase'} bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40`}>
          {t('rejectCancel')}
        </button>
      </div>
    </div>
  )

  return (
    <div className={`border-t border-slate-700/40 ${flush ? '' : 'mt-auto'}`}>
      {status === 'pending' && (confirmReject ? rejectConfirmBlock : (
        <div className={`grid grid-cols-2 gap-px ${roundB} overflow-hidden`}>
          <button onClick={onApprove} disabled={busy} className={`${btn} bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('approve')}
          </button>
          <button onClick={() => setConfirmReject(true)} disabled={busy} className={`${btn} bg-red-600 hover:bg-red-500 active:bg-red-700 text-white`}>
            {t('reject')}
          </button>
        </div>
      ))}

      {status === 'approved' && (confirmReject ? rejectConfirmBlock : (
        <div>
          {kind === 'ad' && publishError ? (
            <p className="text-[10px] text-red-300 px-3 pt-2">{t('publishFailed')}: {publishError}</p>
          ) : null}
          <div className={`grid grid-cols-2 gap-px ${roundB} overflow-hidden`}>
            <button onClick={onPublishOrApply} disabled={busy} className={`${btn} bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (kind === 'ad' ? (publishError ? t('retry') : t('publish')) : t('markApplied'))}
            </button>
            <button onClick={() => setConfirmReject(true)} disabled={busy} className={`${btn} bg-red-600 hover:bg-red-500 active:bg-red-700 text-white`}>
              {t('reject')}
            </button>
          </div>
        </div>
      ))}

      {status === 'applied' && (confirmReject ? rejectConfirmBlock : (
        <button onClick={() => setConfirmReject(true)} disabled={busy} className={`w-full ${btn} bg-red-600/90 hover:bg-red-500 active:bg-red-700 text-white ${roundB}`}>
          {t('reject')}
        </button>
      ))}

      {status === 'rejected_by_user' && (
        <div className="flex items-center justify-between py-2.5 px-3">
          <span className="text-[12px] text-slate-500">{t('status.rejected_by_user')}</span>
          <button onClick={onUndo} disabled={busy} className="text-[12px] text-emerald-400 hover:text-emerald-300 underline disabled:opacity-40">
            {t('undo')}
          </button>
        </div>
      )}
    </div>
  )
}
