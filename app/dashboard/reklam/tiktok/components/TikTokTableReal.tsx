'use client'

import { useTranslations } from 'next-intl'
import type { TikTokCampaign } from '@/hooks/tiktok/useTikTokAdsCampaigns'

interface TikTokTableRealProps {
  campaigns: TikTokCampaign[]
  locale: string
}

const KNOWN_OBJECTIVES = new Set([
  'TRAFFIC', 'CONVERSIONS', 'APP_INSTALL', 'REACH', 'VIDEO_VIEWS',
  'LEAD_GENERATION', 'ENGAGEMENT', 'CATALOG_SALES', 'APP_PROMOTION',
  'WEB_CONVERSIONS', 'PRODUCT_SALES',
])

export default function TikTokTableReal({ campaigns, locale }: TikTokTableRealProps) {
  const t = useTranslations('dashboard.meta')
  const objectiveLabel = (objective: string) =>
    KNOWN_OBJECTIVES.has(objective) ? t(`tiktokObjectives.${objective}`) : objective
  const fmtCurrency = (v: number) =>
    v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtInt = (v: number) => v.toLocaleString(locale)
  const fmtPct = (v: number) =>
    `${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-rose-50/60">
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-left whitespace-nowrap">{t('table.status')}</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-left whitespace-nowrap">{t('table.campaign')}</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-left whitespace-nowrap">{t('table.objective')}</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">{t('table.budget')}</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">{t('kpi.spend')}</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">{t('kpi.impressions')}</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">{t('table.clicks')}</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">{t('kpi.ctr')}</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">{t('table.cpc')}</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">{t('table.conversions')}</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">{t('table.reach')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {campaigns.map((c) => (
            <tr
              key={c.campaignId}
              className="hover:bg-rose-50/30 transition-colors"
            >
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${
                    c.publishEnabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${c.publishEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {c.publishEnabled ? t('table.statusActive') : t('table.paused')}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate" title={c.campaignName}>
                {c.campaignName}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {objectiveLabel(c.objective)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {c.budget > 0 ? fmtCurrency(c.budget) : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums font-medium">
                {fmtCurrency(c.amountSpent)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtInt(c.impressions)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtInt(c.clicks)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtPct(c.ctr)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtCurrency(c.cpc)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtInt(c.conversions)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtInt(c.reach)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
