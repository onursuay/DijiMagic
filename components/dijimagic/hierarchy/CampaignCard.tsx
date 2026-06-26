'use client'

/* SEVİYE 1 — Kampanya kartı (Faz 3) — simetrik yatay mimari.
   Üst: hafif kutu içinde tek satır → logo+durum | Kampanya: … | Kampanya Türü: …
   | Güven Skoru: %… | Ad Set'leri Gör (drill-down).
   Gövde: AI Gerekçesi tam genişlik üstte, altında Öneriler yan yana kart grid'i.
   Footer: kampanya düzeyi advisory karar (Onayla/Reddet/Geri Al) — kampanya türü
   uyumsuzluğu gibi öneriler manuel uygulanır; karar freeze-on-decision'ı besler. */

import { useTranslations, useLocale } from 'next-intl'
import { ChevronRight, AlertOctagon } from 'lucide-react'
import { PlatformBadge, StatusBadge, SuggestionList, titleCaseTr, fixObjectiveTerm } from './shared'
import HierCardActions from './HierCardActions'
import { translateEnum } from '@/lib/dijimagic/translations'
import type { CampaignWithChildren } from '@/lib/dijimagic/ai/hierarchicalStore'

interface Suggestion { title: string; detail: string }
interface CampaignPayload {
  suggestions?: Suggestion[]
  type_mismatch_alert?: { reason: string; recommended_type: string | null; recommended_action: string } | null
  current_objective_label?: string | null
  recommended_objective_label?: string | null
}

interface Props {
  campaign: CampaignWithChildren
  busy?: boolean
  onDrillDown: () => void
  onApprove: () => void
  onReject: () => void
  onUndo: () => void
  onMarkApplied: () => void
}

function Sep() {
  return <span className="text-slate-600 select-none">|</span>
}

export default function CampaignCard({ campaign, busy, onDrillDown, onApprove, onReject, onUndo, onMarkApplied }: Props) {
  const t = useTranslations('dashboard.dijimagic.hierarchy')
  const locale = useLocale() as 'tr' | 'en'
  const payload = (campaign.improvement_payload ?? {}) as CampaignPayload
  const mismatch = payload.type_mismatch_alert
  const confidence = campaign.confidence ?? 0
  // Locale-aware: ham enum varsa translateEnum (TR/EN doğru) — stored TR etiketi yalnız ham enum yoksa fallback.
  const currentType = fixObjectiveTerm(campaign.current_objective ? translateEnum(campaign.current_objective, locale, campaign.source_platform) : (payload.current_objective_label || ''))
  const suggestions = payload.suggestions ?? []

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border bg-[#0f172a] shadow-md transition-all duration-200 hover:border-emerald-400/40 ${mismatch ? 'border-red-500/40 border-l-4 border-l-red-500' : 'border-[#23314d]'}`}>
      <div className="absolute inset-0 pointer-events-none rounded-2xl bg-[radial-gradient(circle_at_15%_30%,rgba(16,185,129,0.06),transparent_55%)]" />

      <div className="relative p-4">
        {/* Üst bar — hafif kutu: kimlik tek satır + UYGULA */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-slate-800/40 border border-slate-700/50 px-3 py-2 mb-3">
          <PlatformBadge platform={campaign.source_platform} />
          <StatusBadge status={campaign.status} />
          <span className="text-[12px] text-slate-400">{t('campaignLevel')}: <span className="text-slate-50 font-medium">{titleCaseTr(campaign.campaign_name)}</span></span>
          <Sep />
          <span className="text-[12px] text-slate-400">{t('campaignType')}: <span className="text-slate-100">{currentType}</span></span>
          <Sep />
          <span className="text-[12px] text-slate-400">{t('confidence')}: <span className="text-slate-100">%{confidence}</span></span>
          <button
            onClick={onDrillDown}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-4 py-1.5 text-[12px] text-white font-semibold transition-colors"
          >
            {t('viewAdsets', { count: campaign.adsets.length })}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Kampanya türü uyumsuzluğu — tam genişlik kırmızı uyarı */}
        {mismatch && (
          <div className="rounded-xl border border-red-500/50 bg-red-950/40 px-3.5 py-2.5 mb-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-red-400" />
                <span className="text-[12px] font-bold text-red-300 uppercase tracking-wide">{t('typeMismatchTitle')}</span>
              </span>
              {mismatch.recommended_type ? (
                <span className="text-[12px] text-red-200">{t('recommendedType')}: <span className="font-semibold">{fixObjectiveTerm(mismatch.recommended_type)}</span></span>
              ) : null}
              {mismatch.recommended_action ? (
                <span className="text-[11px] text-white font-semibold bg-red-600/40 px-2 py-0.5 rounded">{mismatch.recommended_action}</span>
              ) : null}
            </div>
            <p className="text-[12px] text-red-100/90 leading-relaxed mt-1.5">{mismatch.reason}</p>
          </div>
        )}

        {/* AI Gerekçesi — tam genişlik üstte */}
        {campaign.reasoning ? (
          <div className="mb-3">
            <p className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold mb-1">{t('reasoning')}</p>
            <p className="text-[12px] text-slate-200 leading-relaxed">{campaign.reasoning}</p>
          </div>
        ) : null}

        {/* Öneriler — altında yan yana kart grid'i */}
        {suggestions.length ? <SuggestionList label={t('suggestions')} suggestions={suggestions} columns={3} /> : null}
      </div>

      {/* Kampanya düzeyi karar (advisory) — manuel uygulanan öneri; karar lifecycle'ı dondurur */}
      <div className="relative">
        <HierCardActions
          kind="advisory"
          status={campaign.status}
          busy={busy}
          onApprove={onApprove}
          onPublishOrApply={onMarkApplied}
          onReject={onReject}
          onUndo={onUndo}
        />
      </div>
    </div>
  )
}
