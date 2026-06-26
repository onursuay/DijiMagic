'use client'

/* Kampanya kartında "Ad Set'leri Gör" → bu POPUP açılır (Faz 3 UI).
   Hiyerarşi net görünür: Kampanya (+ tür) → Reklam Seti → Reklam.
   FIXED VIEWPORT MODAL — React Portal ile document.body'ye render edilir; sayfa
   akışından/scroll alanından bağımsız her zaman ekranın TAM ORTASINDA açılır. */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations, useLocale } from 'next-intl'
import { X, ChevronLeft, ChevronRight, Megaphone, Layers } from 'lucide-react'
import AdsetCard from './AdsetCard'
import AdCard, { type AdSpecEdit } from './AdCard'
import { titleCaseTr } from './shared'
import { translateEnum } from '@/lib/dijimagic/translations'
import type { CampaignWithChildren, HierLevel } from '@/lib/dijimagic/ai/hierarchicalStore'

interface Props {
  campaign: CampaignWithChildren
  busyId: string | null
  onDecide: (level: HierLevel, id: string, action: 'approve' | 'reject' | 'unreject' | 'applied') => void
  onEditAd: (adId: string, edit: AdSpecEdit) => void | Promise<void>
  onClose: () => void
}

export default function DrilldownModal({ campaign, busyId, onDecide, onEditAd, onClose }: Props) {
  const t = useTranslations('dashboard.dijimagic.hierarchy')
  const tc = useTranslations('common')
  const locale = useLocale() as 'tr' | 'en'
  const [adsetId, setAdsetId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const adset = adsetId ? campaign.adsets.find((a) => a.id === adsetId) : undefined

  // Portal yalnız client'ta (document.body) render edilir.
  useEffect(() => { setMounted(true) }, [])

  // Açılışta gövde tepeden başlasın → ilk reklam seti (ve Onayla/Reddet) hemen görünür.
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0 }, [adsetId])

  // ESC ile kapat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Modal açıkken body scroll kilitli; kapanınca eski haline döner.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const payload = (campaign.improvement_payload ?? {}) as { current_objective_label?: string | null }
  const curType = campaign.current_objective ? translateEnum(campaign.current_objective, locale, campaign.source_platform) : (payload.current_objective_label || '')

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex flex-col rounded-2xl bg-[#0b1120] border border-[#23314d] shadow-2xl"
        style={{ width: 'min(92vw, 900px)', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — hiyerarşi yolu (kompakt, sabit) */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-2.5 border-b border-[#23314d] rounded-t-2xl bg-[#0b1120]">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[12px] text-slate-400 flex-wrap">
              <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">{t('campaignLevel')}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className={adset ? 'text-slate-400' : 'text-slate-200 font-medium'}>{t('adsetLevel')}</span>
              {adset && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-slate-200 font-medium">{t('adLevel')}</span>
                </>
              )}
            </div>
            <h3 className="text-sm font-semibold text-slate-50 leading-snug mt-0.5 truncate">
              {titleCaseTr(campaign.campaign_name)}
              <span className="ml-2 font-normal text-[12px] text-slate-400">· {t('currentType')}: <span className="text-slate-300">{curType}</span></span>
            </h3>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors" aria-label={tc('closeAria')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — tek scroller, tepesi reklam seti bölgesi */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto p-5">
          {!adset ? (
            <>
              <div className="flex items-center gap-2 mb-3 text-[14px] text-slate-200">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">{t('adsetLevel')} ({campaign.adsets.length})</span>
              </div>
              {campaign.adsets.length === 0 ? (
                <p className="text-center py-8 text-[13px] text-slate-400">{t('emptyDrilldown')}</p>
              ) : (
                <div className="grid gap-4 grid-cols-1">
                  {campaign.adsets.map((as) => (
                    <AdsetCard
                      key={as.id}
                      adset={as}
                      horizontal
                      busy={busyId === as.id}
                      onDrillDown={() => setAdsetId(as.id)}
                      onBack={onClose}
                      onApprove={() => onDecide('adset', as.id, 'approve')}
                      onReject={() => onDecide('adset', as.id, 'reject')}
                      onUndo={() => onDecide('adset', as.id, 'unreject')}
                      onMarkApplied={() => onDecide('adset', as.id, 'applied')}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setAdsetId(null)} className="inline-flex items-center gap-1.5 mb-3 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-[12px] text-slate-200 font-semibold uppercase tracking-wide transition-colors">
                <ChevronLeft className="w-4 h-4" /> {t('back')}
              </button>
              <p className="text-[15px] text-slate-50 font-semibold mb-3">{titleCaseTr(adset.adset_name)} <span className="text-slate-400 font-normal">— {t('adLevel')} ({adset.ads.length})</span></p>
              {adset.ads.length === 0 ? (
                <p className="text-center py-10 px-6 text-[13px] text-slate-300 leading-relaxed">{t('emptyAds')}</p>
              ) : (
                <div className="grid gap-4 grid-cols-1">
                  {adset.ads.map((ad) => (
                    <AdCard
                      key={ad.id}
                      ad={ad}
                      horizontal
                      busy={busyId === ad.id}
                      onApprove={() => onDecide('ad', ad.id, 'approve')}
                      onPublish={() => onDecide('ad', ad.id, 'approve')}
                      onReject={() => onDecide('ad', ad.id, 'reject')}
                      onUndo={() => onDecide('ad', ad.id, 'unreject')}
                      onEdit={(edit) => onEditAd(ad.id, edit)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
