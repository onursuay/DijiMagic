'use client'

/* SEVİYE 2 — Ad set / ad group kartı (Faz 3). Popup içinde YATAY.
   Ad set düzeyi advisory karar (Onayla/Reddet/Geri Al) — hedefleme/bütçe önerileri
   manuel uygulanır; karar freeze-on-decision lifecycle'ını besler.
   Kart altı navigasyon: sol "Geri" (popup'ı kapat → kampanya), sağ "İleri"
   (bu ad set'in reklamları). Tüm detaylar AÇIK. */

import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PlatformBadge, StatusBadge, SuggestionList, titleCaseTr } from './shared'
import HierCardActions from './HierCardActions'
import type { AdsetWithAds } from '@/lib/yoai/ai/hierarchicalStore'

interface Suggestion { title: string; detail: string }

interface Props {
  adset: AdsetWithAds
  horizontal?: boolean
  busy?: boolean
  onDrillDown: () => void
  onBack: () => void
  onApprove: () => void
  onReject: () => void
  onUndo: () => void
  onMarkApplied: () => void
}

export default function AdsetCard({ adset, horizontal, busy, onDrillDown, onBack, onApprove, onReject, onUndo, onMarkApplied }: Props) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  const payload = (adset.improvement_payload ?? {}) as { suggestions?: Suggestion[] }
  const confidence = adset.confidence ?? 0
  const suggestions = payload.suggestions ?? []
  const adCount = adset.ads?.length ?? 0
  // FK zinciri için eklenen "boş" ad set kartı (confidence 0 + öneri yok): anlamsız
  // "%0 güven" rozetini ve boş öneri bloğunu gizle; kart kimliği (ad/durum) korunur.
  const isFiller = confidence === 0 && suggestions.length === 0

  return (
    <div className="relative text-left w-full rounded-2xl overflow-hidden border bg-[#0f172a] border-[#23314d] shadow-md flex flex-col h-full transition-all duration-200 hover:border-emerald-400/40">
      <div className="absolute inset-0 pointer-events-none rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.07),transparent_60%)]" />

      <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5 relative">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={adset.source_platform} />
          <StatusBadge status={adset.status} />
        </div>
        {!isFiller && (
          <span className="text-[12px] text-slate-300">%{confidence} {t('confidence').toLowerCase()}</span>
        )}
      </div>

      <div className="px-4 pb-1.5 relative">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{t('adsetLevel')}</p>
        <p className="text-[15px] text-slate-50 font-semibold leading-snug mt-0.5">{titleCaseTr(adset.adset_name)}</p>
      </div>

      {adset.reasoning ? (
        <div className="mx-4 mb-2.5 relative">
          <p className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold mb-1">{t('reasoning')}</p>
          <p className="text-[12px] text-slate-200 leading-relaxed">{adset.reasoning}</p>
        </div>
      ) : null}

      {isFiller ? (
        <div className="flex-1" />
      ) : (
        <div className="mx-4 mb-3 flex-1 relative">
          <SuggestionList label={t('suggestions')} suggestions={suggestions} columns={horizontal ? 2 : 1} />
        </div>
      )}

      {/* Footer: kompakt advisory karar (flush) + altında kompakt Geri/İleri navigasyon */}
      <div className="mt-auto relative">
        <HierCardActions
          kind="advisory"
          status={adset.status}
          busy={busy}
          flush
          compact
          onApprove={onApprove}
          onPublishOrApply={onMarkApplied}
          onReject={onReject}
          onUndo={onUndo}
        />
        {/* Kart altı navigasyon: sol Geri · sağ İleri (reklamlar) — kompakt, normal case */}
        <div className="grid grid-cols-2 gap-px border-t border-slate-700/40 rounded-b-2xl overflow-hidden">
          <button
            onClick={onBack}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> {t('back')}
          </button>
          <button
            onClick={onDrillDown}
            className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-emerald-300 hover:text-emerald-200 font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-colors"
          >
            {t('next')}{adCount > 0 ? ` (${adCount})` : ''} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
