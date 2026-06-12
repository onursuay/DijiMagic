'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  ChevronDown,
  ExternalLink,
  Send,
  RefreshCw,
  Trash2,
  RotateCcw,
  Pencil,
  Globe,
  Users,
  Target,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import type { UnifiedAudience, AudienceType, AudienceStatus } from './wizard/types'
import { STATUS_CONFIG, SOURCE_LABELS, TYPE_LABELS } from './wizard/types'

interface AudienceCardProps {
  audience: UnifiedAudience
  expanded: boolean
  onToggle: () => void
  onDelete?: (id: string) => void
  onEdit?: (id: string) => void
  onSendToMeta?: (id: string) => void
  onSync?: (id: string) => void
  actionLoading?: boolean
}

const TYPE_ICONS: Record<AudienceType, { icon: typeof Globe; color: string }> = {
  CUSTOM: { icon: Target, color: 'bg-purple-100 text-purple-600' },
  LOOKALIKE: { icon: Users, color: 'bg-indigo-100 text-indigo-600' },
  SAVED: { icon: Globe, color: 'bg-teal-100 text-teal-600' },
}

function StatusBadge({ status }: { status: AudienceStatus }) {
  const locale = useLocale()
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {locale === 'en' ? config.en : config.tr}
    </span>
  )
}

/** Meta gerçek boyut verdiyse true; vermediyse (lower < 0) gösterilmez. */
function hasValidCount(count?: { lower: number; upper: number } | null): boolean {
  return !!count && count.lower >= 0
}

function formatCount(count: { lower: number; upper: number }): string {
  const format = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return String(n)
  }
  if (count.lower === count.upper || count.upper === 0) return format(count.lower)
  return `${format(count.lower)} – ${format(count.upper)}`
}

/** Meta custom/lookalike alt tür enum'unu sade etikete çevirir (ham enum gösterilmez). */
const SUBTYPE_LABELS: Record<string, { tr: string; en: string }> = {
  WEBSITE: { tr: 'Web Sitesi', en: 'Website' },
  APP: { tr: 'Uygulama', en: 'App' },
  CUSTOMER_LIST: { tr: 'Müşteri Listesi', en: 'Customer List' },
  ENGAGEMENT: { tr: 'Etkileşim', en: 'Engagement' },
  VIDEO: { tr: 'Video İzleyenler', en: 'Video Viewers' },
  IG_BUSINESS: { tr: 'Instagram', en: 'Instagram' },
  PAGE: { tr: 'Sayfa Etkileşimi', en: 'Page Engagement' },
  LEAD: { tr: 'Form Dolduranlar', en: 'Lead Form' },
  OFFLINE_CONVERSION: { tr: 'Çevrimdışı', en: 'Offline' },
  LOOKALIKE: { tr: 'Benzer Kitle', en: 'Lookalike Audience' },
  CUSTOM: { tr: 'Özel Kitle', en: 'Custom Audience' },
  SAVED: { tr: 'Kayıtlı Kitle', en: 'Saved Audience' },
}
function subtypeLabel(s: string | null | undefined, locale: string): string {
  if (!s) return ''
  const entry = SUBTYPE_LABELS[s]
  if (entry) return locale === 'en' ? entry.en : entry.tr
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

/** Tarihi güvenle çözer; çözemezse null (UI alanı gizler). Meta unix(saniye) + ISO destekli. */
function formatCreatedAt(v: string | null | undefined, locale: string): string | null {
  if (!v) return null
  const d = /^\d{9,}$/.test(v.trim()) ? new Date(Number(v) * 1000) : new Date(v)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString(locale === 'en' ? 'en-US' : 'tr-TR')
}

interface TargetingLabels {
  location: string
  age: string
  gender: string
  interests: string
  male: string
  female: string
}

/** Meta saved audience targeting'ini okunur özet satırlarına çevirir (konum/yaş/cinsiyet/ilgi).
    SAVED kitlelerde subtype/boyut/tarih gelmeyince kartın anlamlı dolması için kullanılır. */
function targetingSummary(t: Record<string, unknown> | undefined, labels: TargetingLabels): { label: string; value: string }[] {
  if (!t || typeof t !== 'object') return []
  const rows: { label: string; value: string }[] = []
  const geo = t.geo_locations as Record<string, unknown> | undefined
  if (geo && typeof geo === 'object') {
    const locs: string[] = []
    if (Array.isArray(geo.countries)) locs.push(...(geo.countries as string[]))
    for (const k of ['cities', 'regions', 'zips']) {
      const arr = geo[k]
      if (Array.isArray(arr)) locs.push(...arr.map((x: any) => x?.name ?? x?.key).filter(Boolean))
    }
    if (locs.length) rows.push({ label: labels.location, value: locs.join(', ') })
  }
  const ageMin = t.age_min as number | undefined
  const ageMax = t.age_max as number | undefined
  if (ageMin != null || ageMax != null) rows.push({ label: labels.age, value: `${ageMin ?? 13}–${ageMax ?? 65}` })
  if (Array.isArray(t.genders) && (t.genders as number[]).length) {
    const g = (t.genders as number[]).map((x) => (x === 1 ? labels.male : x === 2 ? labels.female : '')).filter(Boolean).join(', ')
    if (g) rows.push({ label: labels.gender, value: g })
  }
  const interests: string[] = []
  if (Array.isArray(t.interests)) interests.push(...(t.interests as any[]).map((i) => i?.name).filter(Boolean))
  if (Array.isArray(t.flexible_spec)) {
    for (const fs of t.flexible_spec as any[]) {
      if (fs && Array.isArray(fs.interests)) interests.push(...fs.interests.map((i: any) => i?.name).filter(Boolean))
    }
  }
  if (interests.length) rows.push({ label: labels.interests, value: interests.slice(0, 10).join(', ') })
  return rows
}

export default function AudienceCard({
  audience,
  expanded,
  onToggle,
  onDelete,
  onEdit,
  onSendToMeta,
  onSync,
  actionLoading,
}: AudienceCardProps) {
  const t = useTranslations('dashboard.hedefKitle.card')
  const tc = useTranslations('common')
  const locale = useLocale()
  const typeConfig = TYPE_ICONS[audience.type]
  const TypeIcon = typeConfig.icon
  const [pendingDelete, setPendingDelete] = useState(false)
  const tSummary = targetingSummary(audience.targeting, {
    location: t('targeting.location'),
    age: t('targeting.age'),
    gender: t('targeting.gender'),
    interests: t('targeting.interests'),
    male: t('targeting.male'),
    female: t('targeting.female'),
  })

  // Auto-cancel confirm after 4s, or when card collapses
  useEffect(() => {
    if (!pendingDelete) return
    const t = setTimeout(() => setPendingDelete(false), 4000)
    return () => clearTimeout(t)
  }, [pendingDelete])

  useEffect(() => {
    if (!expanded) setPendingDelete(false)
  }, [expanded])

  return (
    <div className={`bg-white rounded-2xl border transition-shadow ${
      expanded ? 'border-gray-300 shadow-md' : 'border-gray-200 hover:shadow-sm'
    }`}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {/* Type icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeConfig.color}`}>
          <TypeIcon className="w-5 h-5" />
        </div>

        {/* Name + metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{audience.name}</p>
            {/* Origin badge */}
            <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${
              audience.origin === 'local'
                ? 'bg-green-50 text-green-600'
                : 'bg-blue-50 text-blue-600'
            }`}>
              {audience.origin === 'local' ? 'YoAi' : 'Meta'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{locale === 'en' ? TYPE_LABELS[audience.type].en : TYPE_LABELS[audience.type].tr}</span>
            {audience.origin === 'local' && audience.status && (
              <>
                <span className="text-gray-300">·</span>
                <StatusBadge status={audience.status} />
              </>
            )}
            {audience.origin === 'meta' && hasValidCount(audience.approximateCount) && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-500">
                  {t('peopleCount', { count: formatCount(audience.approximateCount!) })}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${
          expanded ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Expanded detail section */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Description */}
          {audience.description && (
            <p className="text-sm text-gray-600">{audience.description}</p>
          )}

          {/* Error message */}
          {audience.origin === 'local' && audience.status === 'ERROR' && audience.errorMessage && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{audience.errorMessage}</span>
            </div>
          )}

          {/* Meta info — tutarlı etiket(üst, küçük-uppercase) / değer(alt, okunur) düzeni */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {audience.origin === 'local' && audience.source && (
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{t('field.source')}</p>
                <p className="text-sm text-gray-800 font-medium">{SOURCE_LABELS[audience.source] ? (locale === 'en' ? SOURCE_LABELS[audience.source].en : SOURCE_LABELS[audience.source].tr) : audience.source}</p>
              </div>
            )}
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{t('field.subtype')}</p>
              <p className="text-sm text-gray-800 font-medium">{audience.subtype ? subtypeLabel(audience.subtype, locale) : (locale === 'en' ? TYPE_LABELS[audience.type].en : TYPE_LABELS[audience.type].tr)}</p>
            </div>
            {hasValidCount(audience.approximateCount) && (
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{t('field.estimatedSize')}</p>
                <p className="text-sm text-gray-800 font-medium">{t('peopleCount', { count: formatCount(audience.approximateCount!) })}</p>
              </div>
            )}
            {audience.origin === 'local' && audience.metaAudienceId && (
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{t('field.metaId')}</p>
                <p className="text-sm text-gray-700 font-mono truncate">{audience.metaAudienceId}</p>
              </div>
            )}
            {formatCreatedAt(audience.createdAt, locale) && (
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{t('field.createdAt')}</p>
                <p className="text-sm text-gray-800 font-medium">{formatCreatedAt(audience.createdAt, locale)}</p>
              </div>
            )}
          </div>

          {/* Hedefleme özeti — SAVED audience targeting (konum/yaş/cinsiyet/ilgi) */}
          {tSummary.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-gray-100">
              {tSummary.map((row) => (
                <div key={row.label} className="flex gap-3 text-sm">
                  <span className="text-[11px] uppercase tracking-wide text-gray-400 font-medium shrink-0 min-w-[88px] pt-0.5">{row.label}</span>
                  <span className="text-sm text-gray-700">{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {/* Local audience actions */}
            {audience.origin === 'local' && (
              <>
                {audience.status === 'DRAFT' && onEdit && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEdit(audience.id) }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {tc('edit')}
                  </button>
                )}
                {audience.type !== 'SAVED' && (audience.status === 'DRAFT' || audience.status === 'ERROR') && onSendToMeta && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSendToMeta(audience.id) }}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : audience.status === 'ERROR' ? (
                      <RotateCcw className="w-3.5 h-3.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {audience.status === 'ERROR' ? tc('retry') : t('action.sendToMeta')}
                  </button>
                )}
                {(audience.status === 'POPULATING' || audience.status === 'READY') && onSync && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSync(audience.id) }}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                    {t('action.sync')}
                  </button>
                )}
                {audience.status !== 'DELETED' && onDelete && (
                  pendingDelete ? (
                    <div className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
                      <span className="text-xs text-red-600 font-medium mr-1">{t('confirmDelete')}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete(audience.id) }}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-100 transition-colors"
                      >
                        {tc('yes')}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPendingDelete(false) }}
                        className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
                      >
                        {tc('cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(true) }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {tc('delete')}
                    </button>
                  )
                )}
              </>
            )}

            {/* Open in Ads Manager (both local with meta_audience_id and meta-fetched) */}
            {(audience.origin === 'meta' || audience.metaAudienceId) && (
              <a
                href={`https://www.facebook.com/adsmanager/audiences?act=${(audience.adAccountId ?? '').replace('act_', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t('action.adsManager')}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
