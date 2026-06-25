'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Search, ChevronRight, ChevronDown, Megaphone, FolderOpen, FileText,
  Plus, X, Loader2, Key, MapPin, Clock, Trash2, Users,
  Banknote, Globe, Settings2, Check, Monitor,
} from 'lucide-react'
import { translateEnum } from '@/lib/dijimagic/translations'
import { CAMPAIGN_TYPE_BIDDING, type AdvertisingChannelType } from './wizard/shared/WizardTypes'
import CampaignSearchTermsTab from './detail/CampaignSearchTermsTab'
import CampaignAssetsTab from './detail/CampaignAssetsTab'
import CampaignLandingPagesTab from './detail/CampaignLandingPagesTab'
import ViewErrorAlert, { type ViewErrorInfo } from './detail/ViewErrorAlert'
import AudienceSegmentEditor from './detail/AudienceSegmentEditor'
import DemographicEditor from './detail/DemographicEditor'

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface RsaAsset { text: string; pinnedField?: string | null }

interface CampaignData {
  id: string; resourceName: string; name: string; status: string
  budgetResourceName: string; dailyBudget: number; dailyBudgetMicros: number
  biddingStrategy: string; channelType?: string
  networkSettings?: { targetGoogleSearch: boolean; targetSearchNetwork: boolean; targetContentNetwork: boolean }
}

interface AdGroupData {
  id: string; resourceName: string; name: string; status: string
  cpcBidMicros: number; cpcBid: number; type?: string
}

interface AdData {
  id: string; resourceName: string; name: string; type: string; status: string
  adGroupId: string; adGroupName: string; finalUrls: string[]
  headlines: RsaAsset[]; descriptions: RsaAsset[]
  path1: string; path2: string
}

interface KeywordData {
  resourceName: string; id: string; text: string
  matchType: 'EXACT' | 'PHRASE' | 'BROAD'; status: string
  isNegative: boolean; cpcBidMicros?: number; qualityScore?: number
  adGroupId: string
}

interface CampNegKw { resourceName: string; id: string; text: string; matchType: string }

interface LocationTarget {
  resourceName: string; criterionId: string; locationName: string
  isNegative: boolean; bidModifier?: number
}

type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
type Minute = 'ZERO' | 'FIFTEEN' | 'THIRTY' | 'FORTY_FIVE'

interface AdScheduleEntry {
  resourceName?: string
  dayOfWeek: DayOfWeek
  startHour: number; startMinute: Minute
  endHour: number; endMinute: Minute
  bidModifier?: number
}

interface GeoResult { id: string; name: string; countryCode: string; targetType: string }

type Selection =
  | { type: 'campaign'; id: string }
  | { type: 'adGroup'; id: string }
  | { type: 'ad'; id: string; adGroupId: string }

interface Props {
  campaignId: string
  onClose: () => void
  onToast: (message: string, type: 'success' | 'error' | 'info') => void
  allCampaignIds?: string[]
  allCampaignData?: Array<{
    id: string
    name: string
    adGroups: Array<{ id: string; name: string; campaignId: string }>
    ads: Array<{ id: string; name: string; adGroupId: string; campaignId: string }>
  }>
  onSwitchCampaign?: (id: string) => void
}

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

/** Bidding strategy values (visible labels resolved via translateEnum(value, locale, 'google')) */
const BIDDING_STRATEGY_VALUES = [
  'MAXIMIZE_CLICKS',
  'MAXIMIZE_CONVERSIONS',
  'TARGET_CPA',
  'TARGET_ROAS',
  'MANUAL_CPC',
  'TARGET_IMPRESSION_SHARE',
]

/** Keyword match-type values (visible labels resolved via translateEnum(value, locale, 'google')) */
const MATCH_TYPE_VALUES: Array<'BROAD' | 'PHRASE' | 'EXACT'> = ['BROAD', 'PHRASE', 'EXACT']

const PIN_OPTION_VALUES: Array<{ value: string; labelKey: string }> = [
  { value: '', labelKey: 'noPin' },
  { value: 'HEADLINE_1', labelKey: 'position1' },
  { value: 'HEADLINE_2', labelKey: 'position2' },
  { value: 'HEADLINE_3', labelKey: 'position3' },
]
const DESC_PIN_OPTION_VALUES: Array<{ value: string; labelKey: string }> = [
  { value: '', labelKey: 'noPin' },
  { value: 'DESCRIPTION_1', labelKey: 'position1' },
  { value: 'DESCRIPTION_2', labelKey: 'position2' },
]

const STRATEGY_MAP: Record<string, string> = {
  'MAXIMIZE_CLICKS': 'MAXIMIZE_CLICKS',
  'TARGET_SPEND': 'MAXIMIZE_CLICKS',
  'MAXIMIZE_CONVERSIONS': 'MAXIMIZE_CONVERSIONS',
  'TARGET_CPA': 'TARGET_CPA',
  'TARGET_ROAS': 'TARGET_ROAS',
  'MANUAL_CPC': 'MANUAL_CPC',
  'ENHANCED_CPC': 'MANUAL_CPC',
  'TARGET_IMPRESSION_SHARE': 'TARGET_IMPRESSION_SHARE',
}

/** Day-of-week values (full visible labels resolved via t('daySchedule.<key>')) */
const DAY_LABEL_KEYS: Record<DayOfWeek, string> = {
  MONDAY: 'monday', TUESDAY: 'tuesday', WEDNESDAY: 'wednesday',
  THURSDAY: 'thursday', FRIDAY: 'friday', SATURDAY: 'saturday', SUNDAY: 'sunday',
}

interface InfoCard {
  title: string
  body: string
}

/** Number of educational info cards per canonical info key (titles/bodies live in i18n under edu.<key>.<idx>.title/body) */
const INFO_CARD_COUNTS: Record<string, number> = {
  genel: 5,
  negatif_anahtar_kelimeler: 5,
  yer: 5,
  ogeler: 5,
  arama_terimleri: 5,
  hedef_kitleler: 5,
  acilis_sayfalari: 5,
  gosterilme_yeri: 5,
  anahtar_kelimeler: 3,
}

/** UI tab (ViewId) → edu canonical key mapping */
const TAB_TO_INFO_KEY: Record<string, string> = {
  genel: 'genel',
  anahtar_kelimeler: 'anahtar_kelimeler',
  negatif_ak: 'negatif_anahtar_kelimeler',
  hedef_kitleler: 'hedef_kitleler',
  yer: 'yer',
  ogeler: 'ogeler',
  arama_terimleri: 'arama_terimleri',
  acilis_sayfalari: 'acilis_sayfalari',
  gosterim_yeri_zamani: 'gosterilme_yeri',
}

const DAYS_ORDER: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

const MINUTE_VALUES: Minute[] = ['ZERO', 'FIFTEEN', 'THIRTY', 'FORTY_FIVE']
const MINUTE_LABELS: Record<Minute, string> = { ZERO: '00', FIFTEEN: '15', THIRTY: '30', FORTY_FIVE: '45' }

/* ═══════════════════════════════════════════
   Campaign Type Schema
   ═══════════════════════════════════════════ */

type SectionId =
  | 'name' | 'budget' | 'bidding' | 'networks'
  | 'locations' | 'schedule' | 'negativeKeywords'
  | 'cpcBid' | 'keywords'
  | 'rsaEditor' | 'adReadonly'

interface EditSchema {
  campaign: SectionId[]
  adGroup: SectionId[]
  ad: SectionId[]
}

const EDIT_SCHEMAS: Record<string, EditSchema> = {
  SEARCH: {
    campaign: ['name', 'budget', 'bidding', 'networks', 'locations', 'schedule', 'negativeKeywords'],
    adGroup: ['name', 'cpcBid', 'keywords'],
    ad: ['rsaEditor'],
  },
  DISPLAY: {
    campaign: ['name', 'budget', 'bidding', 'locations', 'schedule', 'negativeKeywords'],
    adGroup: ['name', 'cpcBid'],
    ad: ['rsaEditor'],
  },
  VIDEO: {
    campaign: ['name', 'budget', 'bidding', 'locations', 'schedule', 'negativeKeywords'],
    adGroup: ['name'],
    ad: ['adReadonly'],
  },
  DEMAND_GEN: {
    campaign: ['name', 'budget', 'bidding', 'locations', 'schedule', 'negativeKeywords'],
    adGroup: ['name'],
    ad: ['adReadonly'],
  },
  PERFORMANCE_MAX: {
    campaign: ['name', 'budget', 'bidding', 'locations', 'schedule'],
    adGroup: ['name'],
    ad: ['adReadonly'],
  },
  SHOPPING: {
    campaign: ['name', 'budget', 'bidding', 'locations', 'schedule', 'negativeKeywords'],
    adGroup: ['name', 'cpcBid'],
    ad: ['adReadonly'],
  },
}

const DEFAULT_SCHEMA: EditSchema = {
  campaign: ['name', 'budget', 'bidding', 'locations'],
  adGroup: ['name'],
  ad: ['adReadonly'],
}

/** Read-only ad notice message key per channel type (resolved via t('adReadonly.<key>')) */
const AD_READONLY_MESSAGE_KEYS: Record<string, string> = {
  VIDEO: 'video',
  DEMAND_GEN: 'demandGen',
  PERFORMANCE_MAX: 'performanceMax',
  SHOPPING: 'shopping',
}

/* ═══════════════════════════════════════════
   View System (Axis 2)
   ═══════════════════════════════════════════ */

type ViewId =
  | 'genel'
  | 'anahtar_kelimeler'
  | 'negatif_ak'
  | 'hedef_kitleler'
  | 'yer'
  | 'ogeler'
  | 'arama_terimleri'
  | 'acilis_sayfalari'
  | 'gosterim_yeri_zamani'

type GyzSubTab = 'cihazlar' | 'zamanlama' | 'yerler' | 'konumlar'

/** View tab id → i18n key under viewLabels.<key> */
const VIEW_LABEL_KEYS: Record<ViewId, string> = {
  genel: 'genel',
  anahtar_kelimeler: 'anahtarKelimeler',
  negatif_ak: 'negatifAk',
  hedef_kitleler: 'hedefKitleler',
  yer: 'yer',
  ogeler: 'ogeler',
  arama_terimleri: 'aramaTerimleri',
  acilis_sayfalari: 'acilisSayfalari',
  gosterim_yeri_zamani: 'gosterimYeriZamani',
}

function getAvailableViews(entityType: Selection['type'], channelType: string): ViewId[] {
  if (entityType === 'campaign') {
    const views: ViewId[] = ['genel']
    if (channelType !== 'PERFORMANCE_MAX') views.push('negatif_ak')
    views.push('yer')
    views.push('ogeler')
    // Arama terimleri: SEARCH only (DISPLAY has no search_term_view)
    if (channelType === 'SEARCH') views.push('arama_terimleri')
    // Gösterim Payı: SEARCH only (impression share metrics are SEARCH-specific)
    // Hedef Kitleler: campaign_audience_view — SEARCH, DISPLAY, VIDEO, DEMAND_GEN
    if (['SEARCH', 'DISPLAY', 'VIDEO', 'DEMAND_GEN'].includes(channelType)) views.push('hedef_kitleler')
    views.push('acilis_sayfalari')
    // Gösterilme Yeri ve Zamanı: schedule for all, placements for DISPLAY/VIDEO/DEMAND_GEN
    if (channelType === 'SEARCH') {
      // SEARCH: only schedule (no detail_placement_view data)
      views.push('gosterim_yeri_zamani')
    } else if (['DISPLAY', 'VIDEO', 'DEMAND_GEN'].includes(channelType)) {
      // DISPLAY/VIDEO/DEMAND_GEN: schedule + placements
      views.push('gosterim_yeri_zamani')
    }
    return views
  }
  if (entityType === 'adGroup') {
    const views: ViewId[] = ['genel']
    if (channelType === 'SEARCH') views.push('anahtar_kelimeler', 'negatif_ak')
    // Hedef Kitleler: ad_group_audience_view — SEARCH, DISPLAY, VIDEO, DEMAND_GEN
    if (['SEARCH', 'DISPLAY', 'VIDEO', 'DEMAND_GEN'].includes(channelType)) views.push('hedef_kitleler')
    if (channelType !== 'SHOPPING') views.push('ogeler')
    // Arama terimleri: SEARCH only
    if (channelType === 'SEARCH') views.push('arama_terimleri')
    // Gösterim Payı: SEARCH only
    if (['SEARCH', 'DISPLAY'].includes(channelType)) views.push('acilis_sayfalari')
    // Gösterilme yeri: ad group level only for DISPLAY (has placements)
    if (['DISPLAY'].includes(channelType)) views.push('gosterim_yeri_zamani')
    return views
  }
  // ad level: only genel
  return ['genel']
}

/* ═══════════════════════════════════════════
   Snapshot helper for dirty state
   ═══════════════════════════════════════════ */

interface FormSnapshot {
  campName: string; campBudget: string; campBidStrategy: string
  campTargetCpa: string; campTargetRoas: string
  campSearchNetwork: boolean; campContentNetwork: boolean
  agName: string; agCpcBid: string
  adHeadlines: string; adDescriptions: string
  adFinalUrl: string; adPath1: string; adPath2: string
  adSchedule: string
}

function makeSnapshot(s: FormSnapshot): string { return JSON.stringify(s) }

/* ═══════════════════════════════════════════
   Inline View Components
   ═══════════════════════════════════════════ */

interface ViewComponentProps {
  data: any
  isLoading: boolean
  error: ViewErrorInfo | null
  onFetch: () => void
}

function AudienceView({ data, isLoading, error, onFetch, entityType, onEditSegments, onEditDemographics }: ViewComponentProps & {
  entityType?: 'campaign' | 'adGroup'
  onEditSegments?: () => void
  onEditDemographics?: () => void
}) {
  const t = useTranslations('dashboard.google.campaignEdit')
  const locale = useLocale()
  useEffect(() => { onFetch() }, [onFetch])

  // Action buttons — always show even during loading/empty
  const actionBar = (onEditSegments || onEditDemographics) ? (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
        <Users className="w-5 h-5 text-gray-500" />
        {t('viewLabels.hedefKitleler')}
      </h3>
      <div className="flex items-center gap-2">
        {onEditSegments && (
          <button
            onClick={onEditSegments}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            {t('audience.editSegments')}
          </button>
        )}
        {onEditDemographics && (
          <button
            onClick={onEditDemographics}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
          >
            {t('audience.editDemographics')}
          </button>
        )}
      </div>
    </div>
  ) : null

  if (isLoading) return <div>{actionBar}<div className="p-6 text-center text-gray-500">{t('audience.loading')}</div></div>
  if (error) return <div>{actionBar}<ViewErrorAlert error={error} /></div>
  if (!data || data.length === 0) return <div>{actionBar}<div className="p-6 text-center text-gray-400">{t('audience.empty')}</div></div>

  const typeLabel = (v: string) => translateEnum(v, locale as any, 'google') || '—'

  return (
    <div>
      {actionBar}
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-[12px] font-medium text-gray-500 uppercase">{t('audience.colAudience')}</th>
            <th className="px-4 py-3 text-left text-[12px] font-medium text-gray-500 uppercase">{t('audience.colType')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.impressions')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.clicks')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.ctr')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.avgCpc')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.cost')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.conversions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row: any, i: number) => (
            <tr key={`${row.resourceName}-${i}`} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-[13px] text-gray-900 font-medium">{row.displayName || '—'}</td>
              <td className="px-4 py-3 text-[13px] text-gray-600">
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[13px]">{typeLabel(row.type)}</span>
              </td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{row.impressions?.toLocaleString('tr-TR') ?? '—'}</td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{row.clicks?.toLocaleString('tr-TR') ?? '—'}</td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{row.ctr != null ? `${row.ctr.toFixed(2)}%` : '—'}</td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">
                {row.cpc != null ? `${row.cpc.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TRY` : '—'}
              </td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">
                {row.cost != null ? `${row.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TRY` : '—'}
              </td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{row.conversions > 0 ? row.conversions.toLocaleString('tr-TR') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  )
}

function DeviceView({ data, isLoading }: { data: any[]; isLoading: boolean }) {
  const t = useTranslations('dashboard.google.campaignEdit')
  if (isLoading) return <div className="p-6 text-center text-gray-500">{t('devices.loading')}</div>
  if (!data || data.length === 0) return <div className="p-6 text-center text-gray-400">{t('devices.empty')}</div>

  const fmtN = (v: number) => v.toLocaleString('tr-TR')
  const fmtC = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-[12px] font-medium text-gray-500 uppercase">{t('devices.colDevice')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.impressions')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.clicks')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.ctr')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.avgCpc')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.cost')}</th>
            <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.conversions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row: any) => (
            <tr key={row.device} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-[13px] text-gray-900 font-medium">{row.deviceLabel || row.device}</td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{fmtN(row.impressions)}</td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{fmtN(row.clicks)}</td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{row.ctr.toFixed(2)}%</td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{fmtC(row.cpc)} TRY</td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{fmtC(row.cost)} TRY</td>
              <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{row.conversions > 0 ? fmtN(row.conversions) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PlacementsView({ data, isLoading, error, onFetch }: ViewComponentProps) {
  const t = useTranslations('dashboard.google.campaignEdit')
  useEffect(() => { onFetch() }, [onFetch])
  if (isLoading) return <div className="p-6 text-center text-gray-500">{t('placements.loading')}</div>
  if (error) return <ViewErrorAlert error={error} />
  if (!data || data.length === 0) return <div className="p-6 text-center text-gray-400">{t('placements.empty')}</div>

  return (
    <div>
      <h3 className="text-[15px] font-semibold text-gray-900 mb-4">{t('placements.title')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-[12px] font-medium text-gray-500 uppercase">{t('placements.colPlacement')}</th>
              <th className="px-4 py-3 text-left text-[12px] font-medium text-gray-500 uppercase">{t('placements.colType')}</th>
              <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.impressions')}</th>
              <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.clicks')}</th>
              <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.ctr')}</th>
              <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.cost')}</th>
              <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('metrics.conversions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row: any, i: number) => (
              <tr key={`${row.targetUrl}-${i}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-[13px] text-gray-900 font-medium max-w-xs truncate">
                  {row.targetUrl ? (
                    <a href={row.targetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {row.displayName || row.targetUrl}
                    </a>
                  ) : (row.displayName || '—')}
                </td>
                <td className="px-4 py-3 text-[13px] text-gray-600">
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[13px]">{row.placementType || '—'}</span>
                </td>
                <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{row.impressions?.toLocaleString('tr-TR') ?? '—'}</td>
                <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{row.clicks?.toLocaleString('tr-TR') ?? '—'}</td>
                <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{row.ctr != null ? `${row.ctr.toFixed(2)}%` : '—'}</td>
                <td className="px-4 py-3 text-[13px] text-gray-900 text-right">
                  {row.cost != null ? `${row.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TRY` : '—'}
                </td>
                <td className="px-4 py-3 text-[13px] text-gray-900 text-right">{row.conversions > 0 ? row.conversions.toLocaleString('tr-TR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export default function CampaignEditPanel({ campaignId, onClose, onToast, allCampaignIds, allCampaignData, onSwitchCampaign }: Props) {
  const t = useTranslations('dashboard.google.campaignEdit')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Data
  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [adGroups, setAdGroups] = useState<AdGroupData[]>([])
  const [ads, setAds] = useState<AdData[]>([])
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [campNegKws, setCampNegKws] = useState<CampNegKw[]>([])
  const [locations, setLocations] = useState<LocationTarget[]>([])
  const [adSchedule, setAdSchedule] = useState<AdScheduleEntry[]>([])

  // Tree state
  const [selected, setSelected] = useState<Selection>({ type: 'campaign', id: campaignId })
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [treeSearch, setTreeSearch] = useState('')

  // Refs for stable callbacks (avoid infinite useEffect loops)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const campaignRef = useRef(campaign)
  campaignRef.current = campaign

  // ── Campaign form ──
  const [campName, setCampName] = useState('')
  const [campBudget, setCampBudget] = useState('')
  const [campBidStrategy, setCampBidStrategy] = useState('')
  const [campTargetCpa, setCampTargetCpa] = useState('')
  const [campTargetRoas, setCampTargetRoas] = useState('')
  const [campSearchNetwork, setCampSearchNetwork] = useState(true)
  const [campContentNetwork, setCampContentNetwork] = useState(false)

  // ── Location form ──
  const [geoQuery, setGeoQuery] = useState('')
  const [geoResults, setGeoResults] = useState<GeoResult[]>([])
  const [geoLoading, setGeoLoading] = useState(false)

  // ── Schedule form ──
  const [newSchedDay, setNewSchedDay] = useState<DayOfWeek>('MONDAY')
  const [newSchedStartH, setNewSchedStartH] = useState(9)
  const [newSchedStartM, setNewSchedStartM] = useState<Minute>('ZERO')
  const [newSchedEndH, setNewSchedEndH] = useState(18)
  const [newSchedEndM, setNewSchedEndM] = useState<Minute>('ZERO')
  const [savingSchedule, setSavingSchedule] = useState(false)

  // ── Ad group form ──
  const [agName, setAgName] = useState('')
  const [agCpcBid, setAgCpcBid] = useState('')

  // ── Ad form ──
  const [adHeadlines, setAdHeadlines] = useState<RsaAsset[]>([])
  const [adDescriptions, setAdDescriptions] = useState<RsaAsset[]>([])
  const [adFinalUrl, setAdFinalUrl] = useState('')
  const [adPath1, setAdPath1] = useState('')
  const [adPath2, setAdPath2] = useState('')

  // ── Keyword add form ──
  const [newKwText, setNewKwText] = useState('')
  const [newKwMatch, setNewKwMatch] = useState<'BROAD' | 'PHRASE' | 'EXACT'>('BROAD')
  const [newKwNeg, setNewKwNeg] = useState(false)
  const [addingKw, setAddingKw] = useState(false)

  // ── Campaign neg keyword add form ──
  const [newCampNegText, setNewCampNegText] = useState('')
  const [newCampNegMatch, setNewCampNegMatch] = useState<'BROAD' | 'PHRASE' | 'EXACT'>('BROAD')
  const [addingCampNeg, setAddingCampNeg] = useState(false)

  // ── Dirty state ──
  const snapshotRef = useRef<string>('')

  // ── Unsaved changes dialog ──
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<Selection | null>(null)

  // ── View system (Axis 2) ──
  const [selectedView, setSelectedView] = useState<ViewId>('genel')
  const [infoCardIndex, setInfoCardIndex] = useState(0)
  const [infoCardVisible, setInfoCardVisible] = useState(true)
  const [infoCardDismissed, setInfoCardDismissed] = useState(false)
  const [viewData, setViewData] = useState<Record<string, any>>({})
  const [viewLoading, setViewLoading] = useState<Record<string, boolean>>({})
  const [viewError, setViewError] = useState<Record<string, ViewErrorInfo | null>>({})

  // ── Gösterilme Yeri ve Zamanı sub-tabs ──
  const [gyzSubView, setGyzSubView] = useState<GyzSubTab>('cihazlar')

  // ── Audience editing drawers ──
  const [showSegmentEditor, setShowSegmentEditor] = useState(false)
  const [showDemographicEditor, setShowDemographicEditor] = useState(false)

  /* ── Current snapshot ── */
  const currentSnapshot = useMemo(() => makeSnapshot({
    campName, campBudget, campBidStrategy, campTargetCpa, campTargetRoas,
    campSearchNetwork, campContentNetwork,
    agName, agCpcBid,
    adHeadlines: JSON.stringify(adHeadlines), adDescriptions: JSON.stringify(adDescriptions),
    adFinalUrl, adPath1, adPath2,
    adSchedule: JSON.stringify(adSchedule),
  }), [campName, campBudget, campBidStrategy, campTargetCpa, campTargetRoas,
    campSearchNetwork, campContentNetwork, agName, agCpcBid,
    adHeadlines, adDescriptions, adFinalUrl, adPath1, adPath2, adSchedule])

  const isDirty = snapshotRef.current !== '' && snapshotRef.current !== currentSnapshot

  /* ── Lock body scroll & Escape key with dirty check ── */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDirty) {
          setPendingSelection(null)
          setShowUnsavedDialog(true)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose, isDirty])

  const infoCards = useMemo(() => {
    const resolvedInfoKey = TAB_TO_INFO_KEY[selectedView] ?? selectedView
    const count = INFO_CARD_COUNTS[resolvedInfoKey] ?? 0
    return Array.from({ length: count }, (_, i) => ({
      title: t(`edu.${resolvedInfoKey}.${i}.title`),
      body: t(`edu.${resolvedInfoKey}.${i}.body`),
    }))
  }, [selectedView, t])

  useEffect(() => {
    if (infoCards.length <= 1) return
    const interval = setInterval(() => {
      setInfoCardVisible(false)
      setTimeout(() => {
        setInfoCardIndex(i => (i + 1) % infoCards.length)
        setInfoCardVisible(true)
      }, 300)
    }, 5000)
    return () => clearInterval(interval)
  }, [selectedView, infoCards.length])

  useEffect(() => {
    setInfoCardIndex(0)
    setInfoCardVisible(true)
    setInfoCardDismissed(false)
  }, [selectedView])

  /* ── Fetch all data ── */
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/edit-data`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('toasts.loadError'))
      setCampaign(data.campaign)
      setAdGroups(data.adGroups ?? [])
      setAds(data.ads ?? [])
      setKeywords(data.keywords ?? [])
      setCampNegKws(data.campaignNegativeKeywords ?? [])
      setLocations(data.locations ?? [])
      setAdSchedule(data.adSchedule ?? [])
      // Init campaign form
      const c = data.campaign
      setCampName(c.name)
      setCampBudget(String(c.dailyBudget))
      setCampBidStrategy(STRATEGY_MAP[c.biddingStrategy] || c.biddingStrategy || '')
      setCampSearchNetwork(c.networkSettings?.targetSearchNetwork ?? true)
      setCampContentNetwork(c.networkSettings?.targetContentNetwork ?? false)
      // Expand all groups
      if (data.adGroups?.length > 0) {
        setExpandedGroups(new Set(data.adGroups.map((ag: AdGroupData) => ag.id)))
      }
    } catch (e: any) {
      onToast(e.message || t('toasts.loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }, [campaignId, onToast, t])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Sync form when selection changes ── */
  useEffect(() => {
    if (selected.type === 'campaign' && campaign) {
      setCampName(campaign.name)
      setCampBudget(String(campaign.dailyBudget))
      setCampBidStrategy(STRATEGY_MAP[campaign.biddingStrategy] || campaign.biddingStrategy || '')
      setCampSearchNetwork(campaign.networkSettings?.targetSearchNetwork ?? true)
      setCampContentNetwork(campaign.networkSettings?.targetContentNetwork ?? false)
    } else if (selected.type === 'adGroup') {
      const ag = adGroups.find((a) => a.id === selected.id)
      if (ag) {
        setAgName(ag.name)
        setAgCpcBid(ag.cpcBid > 0 ? String(ag.cpcBid) : '')
      }
    } else if (selected.type === 'ad') {
      const ad = ads.find((a) => a.id === selected.id && a.adGroupId === selected.adGroupId)
      if (ad) {
        setAdHeadlines(ad.headlines.length > 0 ? [...ad.headlines] : [{ text: '' }])
        setAdDescriptions(ad.descriptions.length > 0 ? [...ad.descriptions] : [{ text: '' }])
        setAdFinalUrl(ad.finalUrls[0] || '')
        setAdPath1(ad.path1)
        setAdPath2(ad.path2)
      }
    }
  }, [selected, campaign, adGroups, ads])

  /* ── Take snapshot after form syncs ── */
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => { snapshotRef.current = currentSnapshot }, 50)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.type, 'id' in selected ? selected.id : '', loading])

  /* ── Selection — free navigation, no dirty check ── */
  const handleSelect = useCallback((next: Selection) => {
    setSelected(next)
  }, [])

  /* ── Reset view when entity changes ── */
  const channelType = campaign?.channelType || 'SEARCH'

  useEffect(() => {
    const available = getAvailableViews(selected.type, channelType)
    if (!available.includes(selectedView)) setSelectedView('genel')
    // Clear view data cache on entity change
    setViewData({})
    setViewError({})
    setGyzSubView('cihazlar')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.type, 'id' in selected ? selected.id : '', channelType])

  const availableViews = useMemo(
    () => getAvailableViews(selected.type, channelType),
    [selected.type, channelType]
  )

  const gyzSubTabs = useMemo(() => {
    const tabs: { id: GyzSubTab; label: string; icon: typeof Monitor }[] = [
      { id: 'cihazlar', label: t('gyzSubTabs.devices'), icon: Monitor },
      { id: 'zamanlama', label: t('gyzSubTabs.schedule'), icon: Clock },
    ]
    if (['DISPLAY', 'VIDEO', 'DEMAND_GEN'].includes(channelType)) {
      tabs.push({ id: 'yerler', label: t('gyzSubTabs.placements'), icon: Globe })
      tabs.push({ id: 'konumlar', label: t('gyzSubTabs.locations'), icon: MapPin })
    }
    return tabs
  }, [channelType, t])

  /* ── Per-view fallback user messages ── */
  const VIEW_USER_MESSAGES: Record<ViewId, string> = useMemo(() => ({
    genel: t('viewErrors.genel'),
    anahtar_kelimeler: t('viewErrors.anahtarKelimeler'),
    negatif_ak: t('viewErrors.negatifAk'),
    hedef_kitleler: t('viewErrors.hedefKitleler'),
    yer: t('viewErrors.yer'),
    ogeler: t('viewErrors.ogeler'),
    arama_terimleri: t('viewErrors.aramaTerimleri'),
    acilis_sayfalari: t('viewErrors.acilisSayfalari'),
    gosterim_yeri_zamani: t('viewErrors.gosterimYeriZamani'),
  }), [t])

  /** Throw a structured ViewErrorInfo from an API error response */
  function throwViewError(data: any, view: ViewId): never {
    throw { userMessage: data.userMessage || VIEW_USER_MESSAGES[view], technicalDetail: data.technicalDetail || data.message || undefined }
  }

  /* ── Lazy fetch for view-specific data ── */
  const fetchViewDataFor = useCallback(async (view: ViewId) => {
    const sel = selectedRef.current
    const camp = campaignRef.current
    setViewLoading(prev => ({ ...prev, [view]: true }))
    setViewError(prev => ({ ...prev, [view]: null }))
    try {
      switch (view) {
        case 'arama_terimleri': {
          const now = new Date()
          const to = now.toISOString().slice(0, 10)
          const from30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
          const body: any = { campaignId, dateRange: { startDate: from30, endDate: to } }
          if (sel.type === 'adGroup') body.adGroupId = sel.id
          const res = await fetch('/api/integrations/google-ads/search-terms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = await res.json()
          if (!res.ok) throwViewError(data, view)
          setViewData(prev => ({ ...prev, arama_terimleri: data.searchTerms ?? [] }))
          break
        }
        case 'ogeler': {
          const url = sel.type === 'adGroup'
            ? `/api/integrations/google-ads/ad-groups/${sel.id}/assets`
            : `/api/integrations/google-ads/campaigns/${campaignId}/assets`
          const res = await fetch(url, { cache: 'no-store' })
          const data = await res.json()
          if (!res.ok) throwViewError(data, view)
          setViewData(prev => ({ ...prev, ogeler: data.assets ?? [] }))
          break
        }
        case 'acilis_sayfalari': {
          const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/landing-pages`, { cache: 'no-store' })
          const data = await res.json()
          if (!res.ok) throwViewError(data, view)
          setViewData(prev => ({ ...prev, acilis_sayfalari: data.landingPages ?? [] }))
          break
        }
        case 'hedef_kitleler': {
          const url = sel.type === 'adGroup'
            ? `/api/integrations/google-ads/ad-groups/${sel.id}/audience-view`
            : `/api/integrations/google-ads/campaigns/${campaignId}/audience-view`
          const res = await fetch(url, { cache: 'no-store' })
          const data = await res.json()
          if (!res.ok) throwViewError(data, view)
          setViewData(prev => ({ ...prev, hedef_kitleler: data.audiences ?? [] }))
          break
        }
        case 'gosterim_yeri_zamani': {
          const ct = camp?.channelType || 'SEARCH'
          // Fetch devices
          const devRes = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/devices`, { cache: 'no-store' })
          const devData = await devRes.json()
          if (!devRes.ok) throwViewError(devData, view)
          setViewData(prev => ({ ...prev, devices: devData.devices ?? [] }))
          // Fetch placements for non-SEARCH
          if (['DISPLAY', 'VIDEO', 'DEMAND_GEN'].includes(ct)) {
            const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/placements`, { cache: 'no-store' })
            const data = await res.json()
            if (!res.ok) throwViewError(data, view)
            setViewData(prev => ({ ...prev, placements: data.placements ?? [] }))
          }
          break
        }
        default:
          break
      }
    } catch (e: any) {
      const errInfo: ViewErrorInfo = e?.userMessage
        ? { userMessage: e.userMessage, technicalDetail: e.technicalDetail }
        : { userMessage: VIEW_USER_MESSAGES[view], technicalDetail: e?.message || undefined }
      setViewError(prev => ({ ...prev, [view]: errInfo }))
    } finally {
      setViewLoading(prev => ({ ...prev, [view]: false }))
    }
  }, [campaignId, VIEW_USER_MESSAGES])

  /* Stable fetch callbacks for detail tab components (they call onFetch on mount) */
  const fetchAramaTerimleri = useCallback(() => fetchViewDataFor('arama_terimleri'), [fetchViewDataFor])
  const fetchOgeler = useCallback(() => fetchViewDataFor('ogeler'), [fetchViewDataFor])
  const fetchAcilisSayfalari = useCallback(() => fetchViewDataFor('acilis_sayfalari'), [fetchViewDataFor])
  const fetchHedefKitleler = useCallback(() => fetchViewDataFor('hedef_kitleler'), [fetchViewDataFor])
  const fetchGosterimYeriZamani = useCallback(() => fetchViewDataFor('gosterim_yeri_zamani'), [fetchViewDataFor])

  /* ── Exclude search term (add as campaign negative keyword via PUT /search-terms) ── */
  const excludeSearchTerm = useCallback(async (searchTerm: string, matchType: 'BROAD' | 'PHRASE' | 'EXACT' = 'EXACT') => {
    if (!campaign?.resourceName) return
    const res = await fetch('/api/integrations/google-ads/search-terms', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignResourceName: campaign.resourceName,
        searchTerm,
        matchType,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || t('toasts.excludeError'))
    }
    onToast(t('toasts.searchTermAddedAsNegative', { term: searchTerm }), 'success')
  }, [campaign?.resourceName, onToast, t])

  /* ── Add search terms as positive keywords to their ad groups ── */
  const addSearchTermAsKeyword = useCallback(async (terms: { text: string; adGroupResourceName: string; matchType: 'BROAD' | 'PHRASE' | 'EXACT' }[]) => {
    // Group by adGroupResourceName
    const grouped = new Map<string, { text: string; matchType: 'BROAD' | 'PHRASE' | 'EXACT' }[]>()
    for (const t of terms) {
      const arr = grouped.get(t.adGroupResourceName) || []
      arr.push({ text: t.text, matchType: t.matchType })
      grouped.set(t.adGroupResourceName, arr)
    }
    // Call API for each ad group
    for (const [adGroupResourceName, keywords] of grouped) {
      const adGroupId = adGroupResourceName.split('/').pop() || ''
      const res = await fetch(`/api/integrations/google-ads/adgroups/${adGroupId}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adGroupResourceName, keywords }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('toasts.keywordAddError'))
      }
    }
    const count = terms.length
    onToast(t('toasts.searchTermsAddedAsKeyword', { count }), 'success')
  }, [onToast, t])

  /* ── Add search terms as campaign negative keywords ── */
  const addSearchTermAsNegative = useCallback(async (terms: { text: string; matchType: 'BROAD' | 'PHRASE' | 'EXACT' }[]) => {
    if (!campaign?.resourceName) return
    const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/negative-keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignResourceName: campaign.resourceName,
        keywords: terms.map(t => ({ text: t.text, matchType: t.matchType })),
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || t('toasts.negKeywordAddError'))
    }
    const count = terms.length
    onToast(t('toasts.searchTermsAddedAsNegative', { count }), 'success')
  }, [campaign?.resourceName, campaignId, onToast, t])

  /* ── Add asset to campaign ── */
  const addAsset = useCallback(async (payload: any) => {
    const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.userMessage || data.error || t('toasts.assetCreateError'))
    }
    onToast(t('toasts.assetCreated'), 'success')
  }, [campaignId, onToast, t])

  /* ── Remove asset from campaign ── */
  const removeAsset = useCallback(async (assetId: string) => {
    const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/assets`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.userMessage || data.error || t('toasts.assetRemoveError'))
    }
    onToast(t('toasts.assetRemoved'), 'success')
  }, [campaignId, onToast, t])

  /* ── Bulk remove assets ── */
  const bulkRemoveAssets = useCallback(async (resourceNames: string[]) => {
    const url = selected.type === 'adGroup'
      ? `/api/integrations/google-ads/ad-groups/${selected.id}/assets`
      : `/api/integrations/google-ads/campaigns/${campaignId}/assets`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resourceNames }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.userMessage || data.error || t('toasts.assetsRemoveError'))
    }
  }, [campaignId, selected, t])

  /* ── Update asset status (pause/enable) ── */
  const updateAssetStatus = useCallback(async (resourceNames: string[], status: 'ENABLED' | 'PAUSED') => {
    const url = selected.type === 'adGroup'
      ? `/api/integrations/google-ads/ad-groups/${selected.id}/assets`
      : `/api/integrations/google-ads/campaigns/${campaignId}/assets`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resourceNames, status }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.userMessage || data.error || t('toasts.assetStatusError'))
    }
  }, [campaignId, selected, t])

  const confirmDiscard = useCallback(() => {
    setShowUnsavedDialog(false)
    if (pendingSelection) {
      setSelected(pendingSelection)
      setPendingSelection(null)
    } else {
      onClose()
    }
  }, [pendingSelection, onClose])

  /* ═══ SAVE HANDLERS ═══ */

  const saveCampaign = async () => {
    if (!campaign) return
    setSaving(true)
    try {
      const payload: Record<string, any> = {}
      if (campName.trim() && campName !== campaign.name) payload.name = campName.trim()
      const b = parseFloat(campBudget)
      if (Number.isFinite(b) && b >= 0 && b !== campaign.dailyBudget) payload.budget = b
      if (campBidStrategy && campBidStrategy !== (STRATEGY_MAP[campaign.biddingStrategy] || campaign.biddingStrategy)) {
        payload.biddingStrategy = campBidStrategy
        if (campBidStrategy === 'TARGET_CPA' && campTargetCpa) {
          payload.targetCpaMicros = Math.round(parseFloat(campTargetCpa) * 1_000_000)
        }
        if (campBidStrategy === 'TARGET_ROAS' && campTargetRoas) {
          payload.targetRoas = parseFloat(campTargetRoas)
        }
      }
      // networkSettings yalnız SEARCH'te geçerli; PMax/Display/Video'da göndermek update'i tümden reddettirebilir.
      if (channelType === 'SEARCH') {
        payload.networkSettings = { targetSearchNetwork: campSearchNetwork, targetContentNetwork: campContentNetwork }
      }

      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || t('toasts.campaignUpdateError'))
      onToast(t('toasts.campaignUpdated'), 'success')
      setCampaign((prev) => prev ? { ...prev, name: campName, dailyBudget: b || prev.dailyBudget } : prev)
      setTimeout(() => { snapshotRef.current = currentSnapshot }, 50)
    } catch (e: any) {
      onToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveAdGroup = async () => {
    if (selected.type !== 'adGroup') return
    const ag = adGroups.find((a) => a.id === selected.id)
    if (!ag) return
    setSaving(true)
    try {
      const payload: Record<string, any> = {}
      if (agName.trim() && agName !== ag.name) payload.name = agName.trim()
      const bid = parseFloat(agCpcBid)
      if (Number.isFinite(bid) && bid >= 0) payload.cpcBid = bid

      const res = await fetch(`/api/integrations/google-ads/ad-groups/${ag.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || t('toasts.adGroupUpdateError'))
      onToast(t('toasts.adGroupUpdated'), 'success')
      setAdGroups((prev) => prev.map((a) => a.id === ag.id ? { ...a, name: agName || a.name, cpcBid: bid || a.cpcBid } : a))
      setTimeout(() => { snapshotRef.current = currentSnapshot }, 50)
    } catch (e: any) {
      onToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveAd = async () => {
    if (selected.type !== 'ad') return
    const ad = ads.find((a) => a.id === selected.id && a.adGroupId === selected.adGroupId)
    if (!ad) return
    const validH = adHeadlines.filter((h) => h.text.trim())
    const validD = adDescriptions.filter((d) => d.text.trim())
    if (validH.length < 3) { onToast(t('toasts.minHeadlines'), 'error'); return }
    if (validD.length < 2) { onToast(t('toasts.minDescriptions'), 'error'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/integrations/google-ads/ads/${ad.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adGroupId: ad.adGroupId,
          headlines: validH.map((h) => ({ text: h.text.trim(), pinnedField: h.pinnedField || undefined })),
          descriptions: validD.map((d) => ({ text: d.text.trim(), pinnedField: d.pinnedField || undefined })),
          finalUrls: adFinalUrl.trim() ? [adFinalUrl.trim()] : undefined,
          path1: adPath1,
          path2: adPath2,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || t('toasts.adUpdateError'))
      onToast(t('toasts.adUpdated'), 'success')
      setAds((prev) => prev.map((a) =>
        a.id === ad.id && a.adGroupId === ad.adGroupId
          ? { ...a, headlines: validH, descriptions: validD, finalUrls: adFinalUrl ? [adFinalUrl] : a.finalUrls, path1: adPath1, path2: adPath2 }
          : a
      ))
      setTimeout(() => { snapshotRef.current = currentSnapshot }, 50)
    } catch (e: any) {
      onToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    if (selected.type === 'campaign') saveCampaign()
    else if (selected.type === 'adGroup') saveAdGroup()
    else if (selected.type === 'ad') saveAd()
  }

  /* ═══ KEYWORD CRUD ═══ */

  const addKeyword = async (adGroupId?: string) => {
    const agId = adGroupId || (selected.type === 'adGroup' ? selected.id : null)
    if (!newKwText.trim() || !agId) return
    const ag = adGroups.find((a) => a.id === agId)
    if (!ag) return
    setAddingKw(true)
    try {
      const res = await fetch(`/api/integrations/google-ads/adgroups/${ag.id}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adGroupResourceName: ag.resourceName,
          keywords: [{ text: newKwText.trim(), matchType: newKwMatch }],
          type: newKwNeg ? 'negative' : 'positive',
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || t('toasts.addError')) }
      onToast(t('toasts.keywordAdded'), 'success')
      setNewKwText('')
      const kwRes = await fetch(`/api/integrations/google-ads/adgroups/${ag.id}/keywords`)
      const kwData = await kwRes.json()
      if (kwData.keywords) {
        setKeywords((prev) => [
          ...prev.filter((k) => k.adGroupId !== ag.id),
          ...kwData.keywords.map((k: any) => ({ ...k, adGroupId: ag.id })),
        ])
      }
    } catch (e: any) {
      onToast(e.message, 'error')
    } finally {
      setAddingKw(false)
    }
  }

  const removeKeyword = async (kw: KeywordData) => {
    try {
      const res = await fetch(`/api/integrations/google-ads/adgroups/${kw.adGroupId}/keywords`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceName: kw.resourceName }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || t('toasts.deleteError')) }
      setKeywords((prev) => prev.filter((k) => k.resourceName !== kw.resourceName))
      onToast(t('toasts.keywordDeleted'), 'success')
    } catch (e: any) {
      onToast(e.message, 'error')
    }
  }

  /* ═══ CAMPAIGN NEG KEYWORD CRUD ═══ */

  const addCampNegKw = async () => {
    if (!newCampNegText.trim() || !campaign) return
    setAddingCampNeg(true)
    try {
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/negative-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignResourceName: campaign.resourceName,
          keywords: [{ text: newCampNegText.trim(), matchType: newCampNegMatch }],
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || t('toasts.addError')) }
      onToast(t('toasts.negKeywordAdded'), 'success')
      setNewCampNegText('')
      await fetchData()
    } catch (e: any) {
      onToast(e.message, 'error')
    } finally {
      setAddingCampNeg(false)
    }
  }

  const removeCampNegKw = async (nk: CampNegKw) => {
    try {
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/negative-keywords`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceName: nk.resourceName }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || t('toasts.deleteError')) }
      setCampNegKws((prev) => prev.filter((k) => k.resourceName !== nk.resourceName))
      onToast(t('toasts.negKeywordDeleted'), 'success')
    } catch (e: any) {
      onToast(e.message, 'error')
    }
  }

  /* ═══ LOCATION CRUD ═══ */

  const searchGeo = useCallback(async (q: string) => {
    if (q.length < 2) { setGeoResults([]); return }
    setGeoLoading(true)
    try {
      const res = await fetch(`/api/integrations/google-ads/geo-targets?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setGeoResults(data.results ?? [])
    } catch { setGeoResults([]) }
    finally { setGeoLoading(false) }
  }, [])

  useEffect(() => {
    if (!geoQuery.trim()) { setGeoResults([]); return }
    const t = setTimeout(() => searchGeo(geoQuery), 300)
    return () => clearTimeout(t)
  }, [geoQuery, searchGeo])

  const addLocation = async (geo: GeoResult, isNegative = false) => {
    if (!campaign) return
    try {
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignResourceName: campaign.resourceName,
          geoTargetConstantId: geo.id,
          isNegative,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || t('toasts.locationAddError')) }
      onToast(isNegative ? t('toasts.locationExcluded', { name: geo.name }) : t('toasts.locationTargeted', { name: geo.name }), 'success')
      const locRes = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/locations`)
      const locData = await locRes.json()
      setLocations(locData.locations ?? [])
      setGeoQuery('')
      setGeoResults([])
    } catch (e: any) {
      onToast(e.message, 'error')
    }
  }

  const removeLocation = async (loc: LocationTarget) => {
    try {
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/locations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceName: loc.resourceName }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || t('toasts.locationRemoveError')) }
      setLocations((prev) => prev.filter((l) => l.resourceName !== loc.resourceName))
      onToast(t('toasts.locationRemoved'), 'success')
    } catch (e: any) {
      onToast(e.message, 'error')
    }
  }

  /* ═══ AD SCHEDULE ═══ */

  const addScheduleEntry = () => {
    if (newSchedStartH >= newSchedEndH && newSchedStartH !== 0) return
    setAdSchedule((prev) => [...prev, {
      dayOfWeek: newSchedDay,
      startHour: newSchedStartH, startMinute: newSchedStartM,
      endHour: newSchedEndH, endMinute: newSchedEndM,
    }])
  }

  const removeScheduleEntry = (idx: number) => {
    setAdSchedule((prev) => prev.filter((_, i) => i !== idx))
  }

  const applySchedulePreset = (preset: 'business' | 'clear') => {
    if (preset === 'clear') {
      setAdSchedule([])
    } else {
      const entries: AdScheduleEntry[] = (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as DayOfWeek[]).map((day) => ({
        dayOfWeek: day, startHour: 9, startMinute: 'ZERO' as Minute,
        endHour: 18, endMinute: 'ZERO' as Minute,
      }))
      setAdSchedule(entries)
    }
  }

  const saveSchedule = async () => {
    if (!campaign) return
    setSavingSchedule(true)
    try {
      const existingRNs = adSchedule.filter((s) => s.resourceName).map((s) => s.resourceName!)
      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/ad-schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignResourceName: campaign.resourceName,
          existingResourceNames: existingRNs,
          newSchedule: adSchedule.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startHour: s.startHour, startMinute: s.startMinute,
            endHour: s.endHour, endMinute: s.endMinute,
          })),
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || t('toasts.scheduleSaveError')) }
      onToast(t('toasts.scheduleUpdated'), 'success')
      const schedRes = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/ad-schedule`)
      const schedData = await schedRes.json()
      setAdSchedule(schedData.schedule ?? [])
    } catch (e: any) {
      onToast(e.message, 'error')
    } finally {
      setSavingSchedule(false)
    }
  }

  /* ═══ TREE HELPERS ═══ */

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const matchLabel = (mt: string) => translateEnum(mt, locale as any, 'google')

  // Tree search filter
  const q = treeSearch.toLowerCase().trim()

  const adsByGroup = useMemo(() => {
    const map: Record<string, AdData[]> = {}
    ads.forEach((a) => {
      if (!map[a.adGroupId]) map[a.adGroupId] = []
      map[a.adGroupId].push(a)
    })
    return map
  }, [ads])

  const filteredGroups = useMemo(() => {
    if (!q) return adGroups
    return adGroups.filter((ag) => {
      if (ag.name.toLowerCase().includes(q)) return true
      const groupAds = adsByGroup[ag.id] || []
      return groupAds.some((ad) => (ad.name || '').toLowerCase().includes(q))
    })
  }, [adGroups, q, adsByGroup])

  const campaignMatchesSearch = !q || (campaign?.name || '').toLowerCase().includes(q) || filteredGroups.length > 0

  // Selection helpers
  const isActive = (type: string, id: string, adGroupId?: string) => {
    if (selected.type !== type) return false
    if (type === 'ad') return selected.type === 'ad' && selected.id === id && selected.adGroupId === adGroupId
    return selected.type !== 'ad' && selected.id === id
  }

  const selectedAg = selected.type === 'adGroup' ? adGroups.find((a) => a.id === selected.id) : null
  const selectedAd = selected.type === 'ad' ? ads.find((a) => a.id === selected.id && a.adGroupId === selected.adGroupId) : null

  // Keywords for the selected ad group (shown in adGroup form for SEARCH)
  const agKeywords = selected.type === 'adGroup' ? keywords.filter((k) => k.adGroupId === selected.id) : []
  const agPositiveKws = agKeywords.filter((k) => !k.isNegative)
  const agNegativeKws = agKeywords.filter((k) => k.isNegative)

  // Location split
  const targetedLocations = locations.filter((l) => !l.isNegative)
  const excludedLocations = locations.filter((l) => l.isNegative)

  // Ad preview
  const previewH = adHeadlines.filter((h) => h.text.trim()).slice(0, 3).map((h) => h.text.trim()).join(' | ')
  const previewD = adDescriptions.filter((d) => d.text.trim()).slice(0, 2).map((d) => d.text.trim()).join(' ')
  const previewUrl = adFinalUrl || 'www.example.com'
  const displayPath = [adPath1, adPath2].filter(Boolean).join('/')

  /* ═══ SCHEMA DERIVATION ═══ */

  const schema = EDIT_SCHEMAS[channelType] || DEFAULT_SCHEMA

  // Filtered bidding strategies for current campaign type
  const allowedBiddingValues = CAMPAIGN_TYPE_BIDDING[channelType as AdvertisingChannelType] || []
  const filteredBiddingStrategies = BIDDING_STRATEGY_VALUES
    .filter((v) => allowedBiddingValues.includes(v as any))
    .map((v) => ({ value: v, label: translateEnum(v, locale as any, 'google') }))
  const currentStrategyInList = filteredBiddingStrategies.some((s) => s.value === campBidStrategy)
  const biddingOptions = currentStrategyInList
    ? filteredBiddingStrategies
    : [
        ...filteredBiddingStrategies,
        ...(campBidStrategy ? [{ value: campBidStrategy, label: t('biddingCurrentSuffix', { label: translateEnum(campBidStrategy, locale as any, 'google') }) }] : []),
      ]

  /* ═══ BREADCRUMB ═══ */

  const breadcrumb = useMemo(() => {
    const parts: { label: string; sel: Selection | null }[] = []
    parts.push({ label: campaign?.name || t('fallback.campaign'), sel: { type: 'campaign', id: campaignId } })

    if (selected.type === 'adGroup') {
      const ag = adGroups.find((a) => a.id === selected.id)
      parts.push({ label: ag?.name || t('fallback.adGroup'), sel: null })
    } else if (selected.type === 'ad') {
      const ad = ads.find((a) => a.id === selected.id && a.adGroupId === selected.adGroupId)
      const ag = adGroups.find((a) => a.id === selected.adGroupId)
      parts.push({ label: ag?.name || t('fallback.adGroup'), sel: { type: 'adGroup', id: selected.adGroupId } })
      parts.push({ label: ad?.name || t('fallback.adNumber', { id: selected.id }), sel: null })
    }

    return parts
  }, [selected, campaign, adGroups, ads, campaignId, t])

  const isFormView = selectedView === 'genel'
  const saveDisabled = saving || loading || !isDirty || !isFormView

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ── HEADER ── */}
      <div className="min-h-[64px] flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/platform-icons/google-ads.svg" alt="Google Ads" className="w-7 h-7 shrink-0" />
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900 leading-tight">{t('header.title')}</h2>
            <p className="text-[13px] text-gray-500 truncate max-w-[400px]">{t('header.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isDirty) { setPendingSelection(null); setShowUnsavedDialog(true) }
              else onClose()
            }}
            className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {tc('close')}
          </button>
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            className="px-5 py-2 text-[13px] font-medium text-white bg-[#2BB673] rounded-lg hover:bg-[#249E63] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {tc('save')}
          </button>
        </div>
      </div>

      {/* ── BODY: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT TREE SIDEBAR ── */}
        <div className="w-[280px] border-r border-gray-200 flex flex-col flex-shrink-0 bg-gray-50/50 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder={t('tree.searchPlaceholder')}
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-green-300 focus:border-green-300"
              />
            </div>
          </div>

          {/* Tree */}
          <div className="overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : allCampaignData && allCampaignData.length > 1 ? (
              allCampaignData.map((c) => {
                const isCurrent = c.id === campaignId
                return (
                  <div key={c.id}>
                    {/* Kampanya */}
                    <div
                      onClick={() => {
                        if (!isCurrent) {
                          onSwitchCampaign?.(c.id)
                        } else {
                          handleSelect({ type: 'campaign', id: c.id })
                        }
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 cursor-pointer text-[13px] hover:bg-gray-100 transition-colors ${
                        isActive('campaign', c.id) ? 'bg-green-50 border-l-2 border-green-500 text-green-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <span className="w-3.5 shrink-0" />
                      <Megaphone className={`w-3.5 h-3.5 shrink-0 ${isActive('campaign', c.id) ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="truncate flex-1" title={c.name}>{c.name}</span>
                    </div>
                    {/* Ad Groups */}
                    {c.adGroups.map((ag) => (
                      <div key={ag.id}>
                        <div
                          onClick={() => handleSelect({ type: 'adGroup', id: ag.id })}
                          className={`flex items-center gap-1 pl-7 pr-3 py-1.5 cursor-pointer text-[13px] hover:bg-gray-100 transition-colors ${
                            isActive('adGroup', ag.id) ? 'bg-green-50 border-l-2 border-green-500 text-green-700 font-medium' : 'text-gray-600'
                          }`}
                        >
                          <span className="w-3.5 shrink-0" />
                          <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isActive('adGroup', ag.id) ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className="truncate flex-1" title={ag.name}>{ag.name}</span>
                        </div>
                        {/* Ads */}
                        {c.ads.filter((a) => a.adGroupId === ag.id).map((ad) => (
                          <div
                            key={ad.id}
                            onClick={() => handleSelect({ type: 'ad', id: ad.id, adGroupId: ad.adGroupId })}
                            className={`flex items-center gap-1.5 pl-14 pr-3 py-1.5 cursor-pointer text-[13px] hover:bg-gray-100 transition-colors ${
                              isActive('ad', ad.id, ad.adGroupId) ? 'bg-green-50 border-l-2 border-green-500 text-green-700 font-medium' : 'text-gray-500'
                            }`}
                          >
                            <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive('ad', ad.id, ad.adGroupId) ? 'text-green-600' : 'text-gray-400'}`} />
                            <span className="break-all text-[13px]" title={ad.name}>{ad.name}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })
            ) : !campaignMatchesSearch ? (
              <div className="px-4 py-8 text-center text-[13px] text-gray-400">{t('tree.noResults')}</div>
            ) : (
              <>
                {/* Campaign node */}
                <div
                  className={`flex items-center gap-1 px-3 py-1.5 cursor-pointer text-[13px] hover:bg-gray-100 transition-colors ${
                    isActive('campaign', campaignId) ? 'bg-green-50 border-l-2 border-green-500 text-green-700 font-medium' : 'text-gray-700'
                  }`}
                >
                  <button onClick={() => toggleGroup('__campaign__')} className="p-0.5 shrink-0">
                    {adGroups.length > 0 ? (
                      expandedGroups.size > 0 ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    ) : <span className="w-3.5" />}
                  </button>
                  <Megaphone className={`w-3.5 h-3.5 shrink-0 ${isActive('campaign', campaignId) ? 'text-green-600' : 'text-gray-400'}`} />
                  <span
                    onClick={() => handleSelect({ type: 'campaign', id: campaignId })}
                    className="truncate flex-1"
                    title={campaign?.name}
                  >
                    {campaign?.name}
                  </span>
                </div>

                {/* Ad groups */}
                {filteredGroups.map((ag) => {
                  const isExpanded = expandedGroups.has(ag.id)
                  const groupAds = adsByGroup[ag.id] || []
                  const hasChildren = groupAds.length > 0
                  const isAgCurrent = isActive('adGroup', ag.id)

                  return (
                    <div key={ag.id}>
                      <div
                        className={`flex items-center gap-1 pl-7 pr-3 py-1.5 cursor-pointer text-[13px] hover:bg-gray-100 transition-colors ${
                          isAgCurrent ? 'bg-green-50 border-l-2 border-green-500 text-green-700 font-medium' : 'text-gray-600'
                        }`}
                      >
                        <button onClick={() => toggleGroup(ag.id)} className="p-0.5 shrink-0">
                          {hasChildren ? (
                            isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                          ) : <span className="w-3.5" />}
                        </button>
                        <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isAgCurrent ? 'text-green-600' : 'text-gray-400'}`} />
                        <span
                          onClick={() => handleSelect({ type: 'adGroup', id: ag.id })}
                          className="truncate flex-1"
                          title={ag.name}
                        >
                          {ag.name}
                        </span>
                      </div>

                      {/* Ads only - no keywords node */}
                      {isExpanded && groupAds.map((ad) => {
                        const isAdCurrent = isActive('ad', ad.id, ad.adGroupId)
                        return (
                          <div
                            key={`${ad.adGroupId}-${ad.id}`}
                            onClick={() => handleSelect({ type: 'ad', id: ad.id, adGroupId: ad.adGroupId })}
                            className={`flex items-center gap-1.5 pl-14 pr-3 py-1.5 cursor-pointer text-[13px] hover:bg-gray-100 transition-colors ${
                              isAdCurrent ? 'bg-green-50 border-l-2 border-green-500 text-green-700 font-medium' : 'text-gray-500'
                            }`}
                          >
                            <FileText className={`w-3.5 h-3.5 shrink-0 ${isAdCurrent ? 'text-green-600' : 'text-gray-400'}`} />
                            <span className="truncate" title={ad.name || t('fallback.adNumber', { id: ad.id })}>{ad.name || t('fallback.adNumber', { id: ad.id })}</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {!infoCardDismissed && infoCards.length > 0 && (
            <div className="flex-1 px-3 py-3 flex flex-col min-h-0 overflow-y-auto">
              <div
                style={{
                  transition: 'opacity 0.6s ease, transform 0.6s ease',
                  opacity: infoCardVisible ? 1 : 0,
                  transform: infoCardVisible ? 'translateY(0)' : 'translateY(-8px)',
                }}
                className="info-card-shine bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/70 rounded-xl p-4 flex flex-col"
              >
                {/* Kapatma butonu */}
                <button
                  onClick={() => setInfoCardDismissed(true)}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-200/50 hover:bg-emerald-300/70 flex items-center justify-center transition-colors z-20"
                >
                  <X className="w-3 h-3 text-emerald-600" />
                </button>
                <div className="relative z-10 flex flex-col pr-4">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-400/30 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-emerald-600 text-[11px] font-bold">i</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {(() => {
                        const effectiveIndex = Math.min(infoCardIndex, Math.max(0, infoCards.length - 1))
                        const activeCard = infoCards[effectiveIndex] as InfoCard | undefined
                        if (!activeCard || typeof activeCard !== 'object' || !('title' in activeCard) || !('body' in activeCard)) return null
                        return (
                          <>
                            <p className="text-[13px] font-semibold text-emerald-900 mb-2 block">{activeCard.title}</p>
                            <p className="text-[12px] text-emerald-800 leading-relaxed pr-1">{activeCard.body}</p>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </div>
                <div className="relative z-10 flex gap-1 justify-center mt-3 shrink-0">
                  {infoCards.map((_, i) => {
                    const effectiveIndex = Math.min(infoCardIndex, Math.max(0, infoCards.length - 1))
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setInfoCardIndex(i)
                          setInfoCardVisible(false)
                          setTimeout(() => setInfoCardVisible(true), 50)
                        }}
                        className={`h-1 rounded-full transition-all duration-500 ${
                          i === effectiveIndex ? 'w-5 bg-emerald-500' : 'w-1.5 bg-emerald-200'
                        }`}
                        aria-label={t('edu.cardAria', { index: i + 1 })}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT WORKSPACE PANEL ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="p-8">
              {/* ── BREADCRUMB ── */}
              {breadcrumb.length > 1 && (
                <nav className="flex items-center gap-1.5 text-[13px] mb-4">
                  {breadcrumb.map((part, idx) => (
                    <span key={idx} className="flex items-center gap-1.5">
                      {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                      {part.sel && idx < breadcrumb.length - 1 ? (
                        <button
                          onClick={() => handleSelect(part.sel!)}
                          className="text-green-600 hover:text-green-700 hover:underline"
                        >
                          {part.label}
                        </button>
                      ) : (
                        <span className={idx === breadcrumb.length - 1 ? 'font-semibold text-gray-900' : 'text-gray-500'}>
                          {part.label}
                        </span>
                      )}
                    </span>
                  ))}
                </nav>
              )}

              {/* ── VIEW TAB STRIP ── */}
              {availableViews.length > 1 && (
                <div className="flex items-center gap-0.5 border-b border-gray-200 mb-6 overflow-x-auto">
                  {availableViews.map((v) => (
                    <button
                      key={v}
                      onClick={() => setSelectedView(v)}
                      className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                        selectedView === v
                          ? 'border-green-500 text-green-700'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {t(`viewLabels.${VIEW_LABEL_KEYS[v]}`)}
                    </button>
                  ))}
                </div>
              )}

              {/* ════════════════════════════════════════════════════
                 CAMPAIGN VIEWS
                 ════════════════════════════════════════════════════ */}
              {selected.type === 'campaign' && campaign && (
                <>
                  {/* ── GENEL ── */}
                  {selectedView === 'genel' && (
                    <div className="grid grid-cols-2 gap-4">

                      {/* ── Kampanya Adı ── */}
                      {schema.campaign.includes('name') && (
                        <div className="relative rounded-xl border border-gray-200/80 shadow-sm overflow-hidden bg-white">
                          <div className="px-5 pt-5 pb-0">
                            <div className="flex items-center gap-3 mb-1.5">
                              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-500 shrink-0">
                                <Megaphone className="w-[18px] h-[18px]" />
                              </div>
                              <div>
                                <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">{t('fields.campaignName.title')}</h3>
                                <p className="text-[13px] text-gray-500 mt-0.5">{t('fields.campaignName.subtitle')}</p>
                              </div>
                            </div>
                          </div>
                          <div className="px-5 pb-5 pt-4">
                            <input type="text" value={campName} onChange={(e) => setCampName(e.target.value)} maxLength={256}
                              placeholder={t('fields.campaignName.placeholder')}
                              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-[13px] text-gray-900 bg-gray-50/50 placeholder:text-gray-400 placeholder:text-[11px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 focus:bg-white focus:shadow-sm" />
                          </div>
                        </div>
                      )}

                      {/* ── Bütçe ── */}
                      {schema.campaign.includes('budget') && (
                        <div className="relative rounded-xl border border-gray-200/80 shadow-sm overflow-hidden bg-white">
                          <div className="px-5 pt-5 pb-0">
                            <div className="flex items-center gap-3 mb-1.5">
                              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-500 shrink-0">
                                <Banknote className="w-[18px] h-[18px]" />
                              </div>
                              <div>
                                <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">{t('fields.budget.title')}</h3>
                                <p className="text-[13px] text-gray-500 mt-0.5">{t('fields.budget.subtitle')}</p>
                              </div>
                            </div>
                          </div>
                          <div className="px-5 pb-5 pt-4">
                            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">{t('fields.budget.dailyLabel')}</label>
                            <div className="relative max-w-xs">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-gray-400 select-none pointer-events-none">TRY</span>
                              <input type="number" step="0.01" min="0" value={campBudget} onChange={(e) => setCampBudget(e.target.value)}
                                placeholder={t('fields.budget.placeholder')}
                                className="w-full pl-12 pr-3.5 py-2.5 border border-gray-200 rounded-lg text-[13px] text-gray-900 bg-gray-50/50 placeholder:text-gray-400 placeholder:text-[11px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 focus:bg-white focus:shadow-sm" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Teklif Stratejisi ── */}
                      {schema.campaign.includes('bidding') && (
                        <div className="relative rounded-xl border border-gray-200/80 shadow-sm overflow-hidden bg-white">
                          <div className="px-5 pt-5 pb-0">
                            <div className="flex items-center gap-3 mb-1.5">
                              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-500 shrink-0">
                                <Settings2 className="w-[18px] h-[18px]" />
                              </div>
                              <div>
                                <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">{t('fields.bidding.title')}</h3>
                                <p className="text-[13px] text-gray-500 mt-0.5">{t('fields.bidding.subtitle')}</p>
                              </div>
                            </div>
                          </div>
                          <div className="px-5 pb-5 pt-4">
                            <div className="relative max-w-md">
                              <select value={campBidStrategy} onChange={(e) => setCampBidStrategy(e.target.value)}
                                className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-lg text-[13px] text-gray-900 bg-gray-50/50 appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 focus:bg-white focus:shadow-sm hover:border-gray-300">
                                <option value="">{tc('selectPlaceholder')}</option>
                                {biddingOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                            {campBidStrategy === 'TARGET_CPA' && (
                              <div className="mt-4 pl-4 border-l-2 border-green-200">
                                <label className="block text-[13px] font-medium text-gray-600 mb-1.5">{t('fields.bidding.targetCpaLabel')}</label>
                                <div className="relative max-w-xs">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-gray-400 select-none pointer-events-none">TRY</span>
                                  <input type="number" step="0.01" min="0" value={campTargetCpa} onChange={(e) => setCampTargetCpa(e.target.value)}
                                    placeholder={t('fields.bidding.targetCpaPlaceholder')}
                                    className="w-full pl-12 pr-3.5 py-2.5 border border-gray-200 rounded-lg text-[13px] text-gray-900 bg-gray-50/50 placeholder:text-gray-400 placeholder:text-[11px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 focus:bg-white focus:shadow-sm" />
                                </div>
                              </div>
                            )}
                            {campBidStrategy === 'TARGET_ROAS' && (
                              <div className="mt-4 pl-4 border-l-2 border-green-200">
                                <label className="block text-[13px] font-medium text-gray-600 mb-1.5">{t('fields.bidding.targetRoasLabel')}</label>
                                <input type="number" step="0.1" min="0" value={campTargetRoas} onChange={(e) => setCampTargetRoas(e.target.value)}
                                  placeholder={t('fields.bidding.targetRoasPlaceholder')}
                                  className="w-full max-w-xs px-3.5 py-2.5 border border-gray-200 rounded-lg text-[13px] text-gray-900 bg-gray-50/50 placeholder:text-gray-400 placeholder:text-[11px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 focus:bg-white focus:shadow-sm" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── Ağ Ayarları ── */}
                      {schema.campaign.includes('networks') && (
                        <div className="col-span-1 relative rounded-xl border border-gray-200/80 shadow-sm overflow-hidden bg-white">
                          <div className="px-5 pt-5 pb-0">
                            <div className="flex items-center gap-3 mb-1.5">
                              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-500 shrink-0">
                                <Globe className="w-[18px] h-[18px]" />
                              </div>
                              <div>
                                <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">{t('fields.networks.title')}</h3>
                                <p className="text-[13px] text-gray-500 mt-0.5">{t('fields.networks.subtitle')}</p>
                              </div>
                            </div>
                          </div>
                          <div className="px-5 pb-5 pt-4">
                            <div className="space-y-2">
                              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                                <input type="checkbox" checked={campSearchNetwork} onChange={(e) => setCampSearchNetwork(e.target.checked)}
                                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                <div>
                                  <p className="text-[15px] font-medium text-gray-800">{t('fields.networks.searchPartnersLabel')}</p>
                                  <p className="text-[13px] text-gray-500">{t('fields.networks.searchPartnersDesc')}</p>
                                </div>
                              </label>
                              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                                <input type="checkbox" checked={campContentNetwork} onChange={(e) => setCampContentNetwork(e.target.checked)}
                                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                <div>
                                  <p className="text-[15px] font-medium text-gray-800">{t('fields.networks.displayNetworkLabel')}</p>
                                  <p className="text-[13px] text-gray-500">{t('fields.networks.displayNetworkDesc')}</p>
                                </div>
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                  {/* ── NEGATİF AK ── */}
                  {selectedView === 'negatif_ak' && (
                    <div className="max-w-2xl">
                      <h3 className="text-[15px] font-semibold text-gray-900">{t('viewLabels.negatifAk')}</h3>
                      <p className="text-[13px] text-gray-500 mt-1 mb-4">{t('negKeywords.campaignSubtitle', { count: campNegKws.length })}</p>
                      {campNegKws.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {campNegKws.map((nk) => (
                            <span key={nk.id} className="inline-flex items-center gap-1 px-2.5 py-1 text-[13px] rounded-full bg-red-50 text-red-600 border border-red-200">
                              <span className="text-red-400">{matchLabel(nk.matchType)}</span>
                              {nk.text}
                              <button onClick={() => removeCampNegKw(nk)} className="hover:text-red-800"><X className="w-3 h-3" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input type="text" value={newCampNegText} onChange={(e) => setNewCampNegText(e.target.value)}
                          placeholder={t('negKeywords.addPlaceholder')} onKeyDown={(e) => { if (e.key === 'Enter') addCampNegKw() }}
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                        <select value={newCampNegMatch} onChange={(e) => setNewCampNegMatch(e.target.value as any)}
                          className="px-3 py-2.5 border border-gray-300 rounded-lg text-[13px] bg-white">
                          {MATCH_TYPE_VALUES.map((m) => <option key={m} value={m}>{translateEnum(m, locale as any, 'google')}</option>)}
                        </select>
                        <button onClick={addCampNegKw} disabled={addingCampNeg || !newCampNegText.trim()}
                          className="px-4 py-2.5 text-[13px] font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5">
                          {addingCampNeg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          {tc('add')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── YER ── */}
                  {selectedView === 'yer' && (
                    <div className="max-w-2xl">
                      <h3 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5" /> {t('locations.title')}
                      </h3>
                      <p className="text-[13px] text-gray-500 mt-1 mb-4">{t('locations.subtitle')}</p>
                      {targetedLocations.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[13px] font-medium text-gray-500 mb-2 uppercase tracking-wide">{t('locations.targeted')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {targetedLocations.map((loc) => (
                              <span key={loc.criterionId} className="inline-flex items-center gap-1 px-2.5 py-1 text-[13px] rounded-full bg-green-50 text-green-700 border border-green-200">
                                {loc.locationName}
                                <button onClick={() => removeLocation(loc)} className="hover:text-green-900"><X className="w-3 h-3" /></button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {excludedLocations.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[13px] font-medium text-gray-500 mb-2 uppercase tracking-wide">{t('locations.excluded')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {excludedLocations.map((loc) => (
                              <span key={loc.criterionId} className="inline-flex items-center gap-1 px-2.5 py-1 text-[13px] rounded-full bg-red-50 text-red-600 border border-red-200">
                                {loc.locationName}
                                <button onClick={() => removeLocation(loc)} className="hover:text-red-800"><X className="w-3 h-3" /></button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="relative mt-3">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="text" value={geoQuery} onChange={(e) => setGeoQuery(e.target.value)}
                              placeholder={t('locations.searchPlaceholder')}
                              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                            />
                            {geoLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />}
                          </div>
                        </div>
                        {geoResults.length > 0 && (
                          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {geoResults.map((geo) => (
                              <div key={geo.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-[13px]">
                                <span className="truncate flex-1">{geo.name}</span>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  <button onClick={() => addLocation(geo, false)}
                                    className="px-2 py-0.5 text-[13px] text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100">
                                    {t('locations.targetButton')}
                                  </button>
                                  <button onClick={() => addLocation(geo, true)}
                                    className="px-2 py-0.5 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100">
                                    {t('locations.excludeButton')}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── ÖĞELER ── */}
                  {selectedView === 'ogeler' && (
                    <CampaignAssetsTab
                      assets={viewData.ogeler ?? []}
                      isLoading={viewLoading.ogeler ?? false}
                      error={viewError.ogeler ?? null}
                      onFetch={fetchOgeler}
                      onAddAsset={addAsset}
                      onRemoveAsset={removeAsset}
                      onBulkRemove={bulkRemoveAssets}
                      onUpdateStatus={updateAssetStatus}
                      entityType="campaign"
                      onToast={onToast}
                    />
                  )}

                  {/* ── ARAMA TERİMLERİ ── */}
                  {selectedView === 'arama_terimleri' && (
                    <CampaignSearchTermsTab
                      searchTerms={viewData.arama_terimleri ?? []}
                      isLoading={viewLoading.arama_terimleri ?? false}
                      error={viewError.arama_terimleri ?? null}
                      onFetch={fetchAramaTerimleri}
                      campaignResourceName={campaign?.resourceName}
                      onExclude={excludeSearchTerm}
                      onAddKeyword={addSearchTermAsKeyword}
                      onAddNegativeKeyword={addSearchTermAsNegative}
                    />
                  )}

                  {/* ── GÖSTERİM PAYI ANALİZİ ── */}
                  {/* ── AÇILIŞ SAYFALARI ── */}
                  {selectedView === 'acilis_sayfalari' && (
                    <CampaignLandingPagesTab
                      landingPages={viewData.acilis_sayfalari ?? []}
                      isLoading={viewLoading.acilis_sayfalari ?? false}
                      error={viewError.acilis_sayfalari ?? null}
                      onFetch={fetchAcilisSayfalari}
                    />
                  )}

                  {/* ── GÖSTERİLME YERİ VE ZAMANI ── */}
                  {selectedView === 'gosterim_yeri_zamani' && (
                    <div className="space-y-0">
                      {/* Sub-tab strip */}
                      <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
                        {gyzSubTabs.map((tab) => {
                          const Icon = tab.icon
                          const active = gyzSubView === tab.id
                          return (
                            <button
                              key={tab.id}
                              onClick={() => setGyzSubView(tab.id)}
                              className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all duration-150 ${
                                active
                                  ? 'border-blue-500 text-blue-600'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              {tab.label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Sub-tab: Cihazlar */}
                      {gyzSubView === 'cihazlar' && (
                        <DeviceView
                          data={viewData.devices ?? []}
                          isLoading={viewLoading.gosterim_yeri_zamani ?? false}
                        />
                      )}

                      {/* Sub-tab: Zamanlama */}
                      {gyzSubView === 'zamanlama' && (
                        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden max-w-2xl">
                          <div className="px-5 pt-5 pb-0">
                            <div className="flex items-center gap-3 mb-1.5">
                              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                                <Clock className="w-[18px] h-[18px]" />
                              </div>
                              <div>
                                <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">{t('schedule.title')}</h3>
                                <p className="text-[13px] text-gray-500 mt-0.5">{t('schedule.subtitle')}</p>
                              </div>
                            </div>
                          </div>
                          <div className="px-5 pb-5 pt-4">
                            {/* Presets */}
                            <div className="flex items-center gap-2 mb-5">
                              <span className="text-[13px] font-medium text-gray-500 mr-1">{t('schedule.presetsLabel')}</span>
                              <button onClick={() => applySchedulePreset('business')}
                                className="px-3.5 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 shadow-sm">
                                {t('schedule.presetBusiness')}
                              </button>
                              <button onClick={() => applySchedulePreset('clear')}
                                className="px-3.5 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 shadow-sm">
                                {t('schedule.presetClear')}
                              </button>
                            </div>

                            {/* Entry list */}
                            {adSchedule.length > 0 && (
                              <div className="border border-gray-200 rounded-lg overflow-hidden mb-5">
                                <div className="divide-y divide-gray-100">
                                  {adSchedule.map((entry, idx) => (
                                    <div key={idx} className="flex items-center gap-3 px-4 py-2.5 text-[13px] bg-white hover:bg-gray-50/50 transition-colors group">
                                      <span className="inline-flex items-center justify-center w-20 py-0.5 text-[13px] font-medium text-green-700 bg-green-50 rounded-md shrink-0">
                                        {t(`daySchedule.${DAY_LABEL_KEYS[entry.dayOfWeek]}`)}
                                      </span>
                                      <span className="text-gray-700 font-mono text-[13px] tracking-wide">
                                        {String(entry.startHour).padStart(2, '0')}:{MINUTE_LABELS[entry.startMinute]}
                                      </span>
                                      <span className="text-gray-300">{'\u2192'}</span>
                                      <span className="text-gray-700 font-mono text-[13px] tracking-wide">
                                        {String(entry.endHour).padStart(2, '0')}:{MINUTE_LABELS[entry.endMinute]}
                                      </span>
                                      <button onClick={() => removeScheduleEntry(idx)}
                                        className="ml-auto text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-150">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Add new entry */}
                            <div className="bg-gray-50/80 rounded-lg border border-gray-200/60 p-4">
                              <p className="text-[13px] font-medium text-gray-500 mb-3">{t('schedule.addNewTitle')}</p>
                              <div className="flex items-end gap-2.5 flex-wrap">
                                <div>
                                  <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wider">{t('schedule.dayLabel')}</label>
                                  <div className="relative">
                                    <select value={newSchedDay} onChange={(e) => setNewSchedDay(e.target.value as DayOfWeek)}
                                      className="px-3 py-2 pr-8 border border-gray-200 rounded-lg text-[13px] bg-white appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 hover:border-gray-300">
                                      {DAYS_ORDER.map((d) => <option key={d} value={d}>{t(`daySchedule.${DAY_LABEL_KEYS[d]}`)}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wider">{t('schedule.startLabel')}</label>
                                  <div className="flex items-center gap-1">
                                    <div className="relative">
                                      <select value={newSchedStartH} onChange={(e) => setNewSchedStartH(Number(e.target.value))}
                                        className="px-2 py-2 pr-6 border border-gray-200 rounded-lg text-[13px] bg-white w-16 appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500">
                                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                                      </select>
                                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                    </div>
                                    <span className="text-gray-400 font-medium">:</span>
                                    <div className="relative">
                                      <select value={newSchedStartM} onChange={(e) => setNewSchedStartM(e.target.value as Minute)}
                                        className="px-2 py-2 pr-6 border border-gray-200 rounded-lg text-[13px] bg-white w-16 appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500">
                                        {MINUTE_VALUES.map((m) => <option key={m} value={m}>{MINUTE_LABELS[m]}</option>)}
                                      </select>
                                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wider">{t('schedule.endLabel')}</label>
                                  <div className="flex items-center gap-1">
                                    <div className="relative">
                                      <select value={newSchedEndH} onChange={(e) => setNewSchedEndH(Number(e.target.value))}
                                        className="px-2 py-2 pr-6 border border-gray-200 rounded-lg text-[13px] bg-white w-16 appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500">
                                        {Array.from({ length: 25 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                                      </select>
                                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                    </div>
                                    <span className="text-gray-400 font-medium">:</span>
                                    <div className="relative">
                                      <select value={newSchedEndM} onChange={(e) => setNewSchedEndM(e.target.value as Minute)}
                                        className="px-2 py-2 pr-6 border border-gray-200 rounded-lg text-[13px] bg-white w-16 appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500">
                                        {MINUTE_VALUES.map((m) => <option key={m} value={m}>{MINUTE_LABELS[m]}</option>)}
                                      </select>
                                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                    </div>
                                  </div>
                                </div>
                                <button onClick={addScheduleEntry}
                                  className="px-3.5 py-2 text-[13px] font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors shadow-sm flex items-center gap-1.5">
                                  <Plus className="w-3.5 h-3.5" /> {tc('add')}
                                </button>
                              </div>
                            </div>

                            {/* Save */}
                            <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
                              <button onClick={saveSchedule} disabled={savingSchedule}
                                className="px-5 py-2.5 text-[13px] font-medium text-white bg-[#2BB673] rounded-lg hover:bg-[#249E63] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm flex items-center gap-2">
                                {savingSchedule && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {t('schedule.saveButton')}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sub-tab: Yerler (DISPLAY/VIDEO/DEMAND_GEN only) */}
                      {gyzSubView === 'yerler' && (
                        <PlacementsView
                          data={viewData.placements ?? []}
                          isLoading={viewLoading.gosterim_yeri_zamani ?? false}
                          error={viewError.gosterim_yeri_zamani ?? null}
                          onFetch={fetchGosterimYeriZamani}
                        />
                      )}

                      {/* Sub-tab: Konumlar */}
                      {gyzSubView === 'konumlar' && (
                        <div>
                          {locations.length === 0 ? (
                            <div className="p-6 text-center text-gray-400">{t('locationsTable.empty')}</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-[12px] font-medium text-gray-500 uppercase">{t('locationsTable.colLocation')}</th>
                                    <th className="px-4 py-3 text-left text-[12px] font-medium text-gray-500 uppercase">{t('locationsTable.colStatus')}</th>
                                    <th className="px-4 py-3 text-right text-[12px] font-medium text-gray-500 uppercase">{t('locationsTable.colBidModifier')}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {locations.map((loc) => (
                                    <tr key={loc.criterionId} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 text-[13px] text-gray-900 font-medium">{loc.locationName}</td>
                                      <td className="px-4 py-3 text-[13px]">
                                        {loc.isNegative ? (
                                          <span className="px-2 py-0.5 rounded-full text-[13px] bg-red-50 text-red-600">{t('locationsTable.excludedBadge')}</span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-full text-[13px] bg-green-50 text-green-700">{t('locationsTable.targetBadge')}</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-[13px] text-gray-900 text-right">
                                        {loc.bidModifier != null ? `${((loc.bidModifier - 1) * 100).toFixed(0)}%` : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── HEDEF KİTLELER ── */}
                  {selectedView === 'hedef_kitleler' && (
                    <AudienceView
                      data={viewData.hedef_kitleler ?? []}
                      isLoading={viewLoading.hedef_kitleler ?? false}
                      error={viewError.hedef_kitleler ?? null}
                      onFetch={fetchHedefKitleler}
                      entityType="campaign"
                      onEditSegments={() => setShowSegmentEditor(true)}
                      onEditDemographics={() => setShowDemographicEditor(true)}
                    />
                  )}
                </>
              )}

              {/* ════════════════════════════════════════════════════
                 AD GROUP VIEWS
                 ════════════════════════════════════════════════════ */}
              {selected.type === 'adGroup' && selectedAg && (
                <>
                  {/* ── GENEL ── */}
                  {selectedView === 'genel' && (
                    <div className="space-y-5 max-w-2xl">

                      {/* ── Reklam Grubu Adı ── */}
                      {schema.adGroup.includes('name') && (
                        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                          <div className="px-5 pt-5 pb-0">
                            <div className="flex items-center gap-3 mb-1.5">
                              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-50 text-green-600 shrink-0">
                                <FileText className="w-[18px] h-[18px]" />
                              </div>
                              <div>
                                <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">{t('fields.adGroupName.title')}</h3>
                                <p className="text-[13px] text-gray-500 mt-0.5">{t('fields.adGroupName.subtitle')}</p>
                              </div>
                            </div>
                          </div>
                          <div className="px-5 pb-5 pt-4">
                            <input type="text" value={agName} onChange={(e) => setAgName(e.target.value)} maxLength={256}
                              placeholder={t('fields.adGroupName.placeholder')}
                              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-[13px] text-gray-900 bg-gray-50/50 placeholder:text-gray-400 placeholder:text-[11px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 focus:bg-white focus:shadow-sm" />
                          </div>
                        </div>
                      )}

                      {/* ── Maks. CPC Teklif ── */}
                      {schema.adGroup.includes('cpcBid') && (
                        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                          <div className="px-5 pt-5 pb-0">
                            <div className="flex items-center gap-3 mb-1.5">
                              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-50 text-green-600 shrink-0">
                                <Banknote className="w-[18px] h-[18px]" />
                              </div>
                              <div>
                                <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">{t('fields.cpcBid.title')}</h3>
                                <p className="text-[13px] text-gray-500 mt-0.5">{t('fields.cpcBid.subtitle')}</p>
                              </div>
                            </div>
                          </div>
                          <div className="px-5 pb-5 pt-4">
                            <div className="relative max-w-xs">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-gray-400 select-none pointer-events-none">TRY</span>
                              <input type="number" step="0.01" min="0" value={agCpcBid} onChange={(e) => setAgCpcBid(e.target.value)}
                                placeholder={t('fields.cpcBid.placeholder')}
                                className="w-full pl-12 pr-3.5 py-2.5 border border-gray-200 rounded-lg text-[13px] text-gray-900 bg-gray-50/50 placeholder:text-gray-400 placeholder:text-[11px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 focus:bg-white focus:shadow-sm" />
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                  {/* ── ANAHTAR KELİMELER ── */}
                  {selectedView === 'anahtar_kelimeler' && (
                    <div className="max-w-2xl">
                      <h3 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
                        <Key className="w-5 h-5" /> {t('viewLabels.anahtarKelimeler')}
                      </h3>
                      <p className="text-[13px] text-gray-500 mt-1 mb-4">
                        {t('keywords.positiveCount', { count: agPositiveKws.length })}
                      </p>
                      {agPositiveKws.length > 0 && (
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-1.5">
                            {agPositiveKws.map((kw) => (
                              <span key={kw.id} className="inline-flex items-center gap-1 px-2.5 py-1 text-[13px] rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="text-blue-400">{matchLabel(kw.matchType)}</span>
                                {kw.text}
                                {kw.qualityScore != null && <span className="text-blue-300 ml-0.5">{t('keywords.qualityScore', { score: kw.qualityScore })}</span>}
                                <button onClick={() => removeKeyword(kw)} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-[13px] font-medium text-gray-700 mb-2">{t('keywords.addTitle')}</p>
                        <div className="flex items-center gap-2">
                          <input type="text" value={newKwText} onChange={(e) => setNewKwText(e.target.value)}
                            placeholder={t('keywords.addPlaceholder')} onKeyDown={(e) => { if (e.key === 'Enter') addKeyword(selected.id) }}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                          <select value={newKwMatch} onChange={(e) => setNewKwMatch(e.target.value as any)}
                            className="px-3 py-2.5 border border-gray-300 rounded-lg text-[13px] bg-white">
                            {MATCH_TYPE_VALUES.map((m) => <option key={m} value={m}>{translateEnum(m, locale as any, 'google')}</option>)}
                          </select>
                          <button onClick={() => addKeyword(selected.id)} disabled={addingKw || !newKwText.trim()}
                            className="px-4 py-2.5 text-[13px] font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1.5">
                            {addingKw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            {tc('add')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── NEGATİF AK (Ad Group) ── */}
                  {selectedView === 'negatif_ak' && (
                    <div className="max-w-2xl">
                      <h3 className="text-[15px] font-semibold text-gray-900">{t('viewLabels.negatifAk')}</h3>
                      <p className="text-[13px] text-gray-500 mt-1 mb-4">
                        {t('negKeywords.adGroupSubtitle', { count: agNegativeKws.length })}
                      </p>
                      {agNegativeKws.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {agNegativeKws.map((kw) => (
                            <span key={kw.id} className="inline-flex items-center gap-1 px-2.5 py-1 text-[13px] rounded-full bg-red-50 text-red-600 border border-red-200">
                              <span className="text-red-400">{matchLabel(kw.matchType)}</span>
                              {kw.text}
                              <button onClick={() => removeKeyword(kw)} className="hover:text-red-800"><X className="w-3 h-3" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-[13px] font-medium text-gray-700 mb-2">{t('negKeywords.addTitle')}</p>
                        <div className="flex items-center gap-2">
                          <input type="text" value={newKwText} onChange={(e) => setNewKwText(e.target.value)}
                            placeholder={t('negKeywords.adGroupAddPlaceholder')} onKeyDown={(e) => { if (e.key === 'Enter') { setNewKwNeg(true); addKeyword(selected.id) } }}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                          <select value={newKwMatch} onChange={(e) => setNewKwMatch(e.target.value as any)}
                            className="px-3 py-2.5 border border-gray-300 rounded-lg text-[13px] bg-white">
                            {MATCH_TYPE_VALUES.map((m) => <option key={m} value={m}>{translateEnum(m, locale as any, 'google')}</option>)}
                          </select>
                          <button onClick={() => { setNewKwNeg(true); addKeyword(selected.id) }} disabled={addingKw || !newKwText.trim()}
                            className="px-4 py-2.5 text-[13px] font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5">
                            {addingKw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            {tc('add')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── ÖĞELER (Ad Group) ── */}
                  {selectedView === 'ogeler' && (
                    <CampaignAssetsTab
                      assets={viewData.ogeler ?? []}
                      isLoading={viewLoading.ogeler ?? false}
                      error={viewError.ogeler ?? null}
                      onFetch={fetchOgeler}
                      onAddAsset={addAsset}
                      onRemoveAsset={removeAsset}
                      onBulkRemove={bulkRemoveAssets}
                      onUpdateStatus={updateAssetStatus}
                      entityType="adGroup"
                      onToast={onToast}
                    />
                  )}

                  {/* ── ARAMA TERİMLERİ (Ad Group) ── */}
                  {selectedView === 'arama_terimleri' && (
                    <CampaignSearchTermsTab
                      searchTerms={viewData.arama_terimleri ?? []}
                      isLoading={viewLoading.arama_terimleri ?? false}
                      error={viewError.arama_terimleri ?? null}
                      onFetch={fetchAramaTerimleri}
                      campaignResourceName={campaign?.resourceName}
                      onExclude={excludeSearchTerm}
                      onAddKeyword={addSearchTermAsKeyword}
                      onAddNegativeKeyword={addSearchTermAsNegative}
                    />
                  )}

                  {/* ── HEDEF KİTLELER (Ad Group) ── */}
                  {selectedView === 'hedef_kitleler' && (
                    <AudienceView
                      data={viewData.hedef_kitleler ?? []}
                      isLoading={viewLoading.hedef_kitleler ?? false}
                      error={viewError.hedef_kitleler ?? null}
                      onFetch={fetchHedefKitleler}
                      entityType="adGroup"
                      onEditSegments={() => setShowSegmentEditor(true)}
                      onEditDemographics={() => setShowDemographicEditor(true)}
                    />
                  )}

                  {/* ── GÖSTERİM PAYI (Ad Group) ── */}
                  {/* ── AÇILIŞ SAYFALARI (Ad Group) ── */}
                  {selectedView === 'acilis_sayfalari' && (
                    <CampaignLandingPagesTab
                      landingPages={viewData.acilis_sayfalari ?? []}
                      isLoading={viewLoading.acilis_sayfalari ?? false}
                      error={viewError.acilis_sayfalari ?? null}
                      onFetch={fetchAcilisSayfalari}
                    />
                  )}

                  {/* ── GÖSTERİLME YERİ VE ZAMANI (Ad Group) ── */}
                  {selectedView === 'gosterim_yeri_zamani' && (
                    <PlacementsView
                      data={viewData.placements ?? []}
                      isLoading={viewLoading.gosterim_yeri_zamani ?? false}
                      error={viewError.gosterim_yeri_zamani ?? null}
                      onFetch={fetchGosterimYeriZamani}
                    />
                  )}
                </>
              )}

              {/* ════════════════════════════════════════════════════
                 AD VIEWS (always genel)
                 ════════════════════════════════════════════════════ */}
              {selected.type === 'ad' && selectedAd && (
                <div className="max-w-2xl">
                  {schema.ad.includes('adReadonly') && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-3 py-1 text-[13px] font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {translateEnum(selectedAd.type, locale as any, 'google')}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-1 text-[13px] font-medium rounded-full ${
                          selectedAd.status === 'ENABLED' ? 'bg-green-50 text-green-700 border border-green-200' :
                          selectedAd.status === 'PAUSED' ? 'bg-gray-50 text-gray-600 border border-gray-200' :
                          'bg-gray-50 text-gray-500 border border-gray-200'
                        }`}>
                          {selectedAd.status === 'ENABLED' ? tc('status.active') : selectedAd.status === 'PAUSED' ? t('adStatus.paused') : selectedAd.status}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-gray-900">{t('adReadonly.adNameLabel')}</h3>
                        <input type="text" value={selectedAd.name || t('fallback.adNumber', { id: selectedAd.id })} disabled
                          className="mt-2 w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-[13px]" />
                      </div>
                      {selectedAd.finalUrls.length > 0 && (
                        <div>
                          <h3 className="text-[15px] font-semibold text-gray-900">{t('adReadonly.finalUrlLabel')}</h3>
                          <div className="mt-2 space-y-1.5">
                            {selectedAd.finalUrls.map((url, idx) => (
                              <div key={idx} className="px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-[13px] text-gray-600 truncate">{url}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <h3 className="text-[15px] font-semibold text-gray-900">{t('adReadonly.adGroupLabel')}</h3>
                        <input type="text" value={selectedAd.adGroupName} disabled
                          className="mt-2 w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-[13px]" />
                      </div>
                      <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-[13px] text-blue-700">
                        {AD_READONLY_MESSAGE_KEYS[channelType] ? t(`adReadonly.${AD_READONLY_MESSAGE_KEYS[channelType]}`) : t('adReadonly.default')}
                      </div>
                    </div>
                  )}
                  {schema.ad.includes('rsaEditor') && (
                    <>
                      {selectedAd.type !== 'RESPONSIVE_SEARCH_AD' ? (
                        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[13px] text-gray-700">
                          {t('rsa.notEditable', { type: translateEnum(selectedAd.type, locale as any, 'google') })}
                        </div>
                      ) : (
                        <div className="space-y-8">
                          <div>
                            <h3 className="text-[15px] font-semibold text-gray-900">{t('rsa.adNameTitle')}</h3>
                            <p className="text-[13px] text-gray-500 mt-1 mb-4">{t('rsa.adNameSubtitle')}</p>
                            <input type="text" value={selectedAd.name || t('fallback.adNumber', { id: selectedAd.id })} disabled
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-[13px]" />
                          </div>
                          <div>
                            <h3 className="text-[15px] font-semibold text-gray-900">{t('rsa.headlinesTitle')}</h3>
                            <p className="text-[13px] text-gray-500 mt-1 mb-4">{t('rsa.headlinesSubtitle', { count: adHeadlines.length })}</p>
                            <div className="space-y-2">
                              {adHeadlines.map((h, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-[13px] text-gray-400 w-5 text-right shrink-0">{idx + 1}</span>
                                  <input type="text" value={h.text}
                                    onChange={(e) => setAdHeadlines(adHeadlines.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))}
                                    maxLength={30} placeholder={t('rsa.headlinePlaceholder')}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                                  <select value={h.pinnedField || ''}
                                    onChange={(e) => setAdHeadlines(adHeadlines.map((x, i) => i === idx ? { ...x, pinnedField: e.target.value || null } : x))}
                                    className="w-28 px-2 py-2 border border-gray-300 rounded-lg text-[13px] bg-white">
                                    {PIN_OPTION_VALUES.map((p) => <option key={p.value} value={p.value}>{t(`pinOptions.${p.labelKey}`)}</option>)}
                                  </select>
                                  <span className={`text-[13px] shrink-0 w-10 text-right ${h.text.length > 25 ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {h.text.length}/30
                                  </span>
                                  {adHeadlines.length > 3 && (
                                    <button onClick={() => setAdHeadlines(adHeadlines.filter((_, i) => i !== idx))}
                                      className="text-gray-400 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                                  )}
                                </div>
                              ))}
                            </div>
                            {adHeadlines.length < 15 && (
                              <button onClick={() => setAdHeadlines([...adHeadlines, { text: '' }])}
                                className="mt-3 text-[13px] text-green-600 hover:text-green-700 flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" /> {t('rsa.addHeadline')}
                              </button>
                            )}
                          </div>
                          <div>
                            <h3 className="text-[15px] font-semibold text-gray-900">{t('rsa.descriptionsTitle')}</h3>
                            <p className="text-[13px] text-gray-500 mt-1 mb-4">{t('rsa.descriptionsSubtitle', { count: adDescriptions.length })}</p>
                            <div className="space-y-2">
                              {adDescriptions.map((d, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-[13px] text-gray-400 w-5 text-right shrink-0">{idx + 1}</span>
                                  <input type="text" value={d.text}
                                    onChange={(e) => setAdDescriptions(adDescriptions.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))}
                                    maxLength={90} placeholder={t('rsa.descriptionPlaceholder')}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                                  <select value={d.pinnedField || ''}
                                    onChange={(e) => setAdDescriptions(adDescriptions.map((x, i) => i === idx ? { ...x, pinnedField: e.target.value || null } : x))}
                                    className="w-28 px-2 py-2 border border-gray-300 rounded-lg text-[13px] bg-white">
                                    {DESC_PIN_OPTION_VALUES.map((p) => <option key={p.value} value={p.value}>{t(`pinOptions.${p.labelKey}`)}</option>)}
                                  </select>
                                  <span className={`text-[13px] shrink-0 w-10 text-right ${d.text.length > 80 ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {d.text.length}/90
                                  </span>
                                  {adDescriptions.length > 2 && (
                                    <button onClick={() => setAdDescriptions(adDescriptions.filter((_, i) => i !== idx))}
                                      className="text-gray-400 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                                  )}
                                </div>
                              ))}
                            </div>
                            {adDescriptions.length < 4 && (
                              <button onClick={() => setAdDescriptions([...adDescriptions, { text: '' }])}
                                className="mt-3 text-[13px] text-green-600 hover:text-green-700 flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" /> {t('rsa.addDescription')}
                              </button>
                            )}
                          </div>
                          <div>
                            <h3 className="text-[15px] font-semibold text-gray-900">{t('rsa.urlPathsTitle')}</h3>
                            <p className="text-[13px] text-gray-500 mt-1 mb-4">{t('rsa.urlPathsSubtitle')}</p>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('rsa.finalUrlLabel')}</label>
                                <input type="url" value={adFinalUrl} onChange={(e) => setAdFinalUrl(e.target.value)}
                                  placeholder="https://www.example.com/sayfa"
                                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('rsa.path1Label')}</label>
                                  <input type="text" value={adPath1} onChange={(e) => setAdPath1(e.target.value)} maxLength={15}
                                    placeholder={t('rsa.path1Placeholder')}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                                </div>
                                <div>
                                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('rsa.path2Label')}</label>
                                  <input type="text" value={adPath2} onChange={(e) => setAdPath2(e.target.value)} maxLength={15}
                                    placeholder={t('rsa.path2Placeholder')}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h3 className="text-[15px] font-semibold text-gray-900">{t('rsa.previewTitle')}</h3>
                            <p className="text-[13px] text-gray-500 mt-1 mb-4">{t('rsa.previewSubtitle')}</p>
                            <div className="border border-gray-200 rounded-xl p-5 bg-white max-w-md">
                              <div className="space-y-1">
                                <p className="text-[13px] text-green-700 truncate">
                                  {previewUrl}{displayPath ? `/${displayPath}` : ''}
                                </p>
                                <p className="text-[15px] text-blue-700 font-medium leading-snug line-clamp-2">
                                  {previewH || t('rsa.headlinePreview')}
                                </p>
                                <p className="text-[13px] text-gray-600 line-clamp-2">
                                  {previewD || t('rsa.descriptionPreview')}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ AUDIENCE / DEMOGRAPHIC DRAWERS ═══ */}
      <AudienceSegmentEditor
        open={showSegmentEditor}
        onClose={() => setShowSegmentEditor(false)}
        entityType={selected.type === 'adGroup' ? 'adGroup' : 'campaign'}
        entityId={selected.type === 'adGroup' ? selected.id : campaignId}
        entityResourceName={selected.type === 'adGroup' ? (selectedAg?.resourceName ?? '') : (campaign?.resourceName ?? '')}
        campaignId={campaignId}
        onSaved={() => { setShowSegmentEditor(false); fetchHedefKitleler() }}
        onToast={onToast}
      />
      <DemographicEditor
        open={showDemographicEditor}
        onClose={() => setShowDemographicEditor(false)}
        entityType={selected.type === 'adGroup' ? 'adGroup' : 'campaign'}
        entityId={selected.type === 'adGroup' ? selected.id : campaignId}
        campaignId={campaignId}
        onSaved={() => { setShowDemographicEditor(false); fetchHedefKitleler() }}
        onToast={onToast}
      />

      {/* ═══ UNSAVED CHANGES DIALOG ═══ */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-[15px] font-semibold text-gray-900 mb-2">{t('unsavedDialog.title')}</h3>
            <p className="text-[13px] text-gray-600 mb-5">{t('unsavedDialog.message')}</p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => { setShowUnsavedDialog(false); setPendingSelection(null) }}
                className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('unsavedDialog.goBack')}
              </button>
              <button
                onClick={confirmDiscard}
                className="px-4 py-2 text-[13px] font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
              >
                {t('unsavedDialog.discard')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
