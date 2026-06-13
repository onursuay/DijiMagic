'use client'

import type { GoogleAd } from '@/hooks/google/useGoogleAdsCampaigns'

const localeString = 'tr-TR'
const fmtInt = (n: number) => (Number.isFinite(n) ? n.toLocaleString(localeString) : '0')
const fmtFixed = (n: number, d: number) => (Number.isFinite(n) ? n.toFixed(d) : '0')
const num = (n: number | null | undefined) => (n != null && Number.isFinite(n) ? n : 0)

// Ad Strength (Reklam Gücü) — Google'ın hesapladığı GERÇEK değer (GAQL ad_group_ad.ad_strength).
// Amber YASAK: zayıf=red, ortalama=gray, iyi=primary, mükemmel=emerald.
const AD_STRENGTH: Record<string, { label: string; cls: string }> = {
  POOR: { label: 'Zayıf', cls: 'bg-red-50 text-red-700' },
  AVERAGE: { label: 'Ortalama', cls: 'bg-gray-100 text-gray-700' },
  GOOD: { label: 'İyi', cls: 'bg-primary/10 text-primary' },
  EXCELLENT: { label: 'Mükemmel', cls: 'bg-emerald-50 text-emerald-700' },
}

interface GoogleAdTableProps {
  ads: GoogleAd[]
  isLoading: boolean
  colSpan: number
  tTable: (key: string) => string
  tGoogle: (key: string) => string
}

export default function GoogleAdTable({
  ads,
  isLoading,
  colSpan,
  tTable,
  tGoogle,
}: GoogleAdTableProps) {
  if (isLoading) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-500">
          {tTable('table.loading')}
        </td>
      </tr>
    )
  }

  if (ads.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-500">
          {tTable('table.noData')}
        </td>
      </tr>
    )
  }

  return (
    <>
      {ads.map((ad) => (
        <tr key={`${ad.campaignId}-${ad.adGroupId}-${ad.adId}`} className="hover:bg-gray-50">
          <td className="px-4 py-4">—</td>
          <td className="px-4 py-4">
            <span className={`inline-flex items-center px-2 py-1 text-caption font-medium rounded-full ${ad.status === 'ENABLED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {ad.status === 'ENABLED' ? tTable('table.active') : tTable('table.inactive')}
            </span>
          </td>
          <td className="px-4 py-4"><span className="text-gray-400">—</span></td>
          <td className="px-4 py-4 text-sm text-gray-900">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{ad.adName}</span>
              <span className="text-caption text-gray-500">{ad.adGroupName} · {ad.campaignName}</span>
              {ad.adStrength && AD_STRENGTH[ad.adStrength] && (
                <span className={`mt-0.5 inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${AD_STRENGTH[ad.adStrength].cls}`}>
                  Reklam Gücü: {AD_STRENGTH[ad.adStrength].label}
                </span>
              )}
            </div>
          </td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">—</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">{num(ad.amountSpent).toLocaleString(localeString, { minimumFractionDigits: 2 })} TRY</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtInt(ad.impressions)}</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtInt(ad.clicks)}</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtFixed(ad.ctr, 2)}%</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtFixed(ad.cpc, 2)} TRY</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">
            {ad.roas != null && ad.roas > 0 ? `${fmtFixed(ad.roas, 1)}x` : '—'}
          </td>
          <td className="px-4 py-4 text-center text-gray-400 text-sm">{tGoogle('comingSoon')}</td>
        </tr>
      ))}
    </>
  )
}
