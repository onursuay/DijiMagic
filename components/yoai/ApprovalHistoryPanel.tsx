'use client'

/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Approval History Panel (Faz 0D)

   Kullanıcının son approval kararlarını modern kart grid'inde gösterir.
   Veri kaynağı: /api/yoai/approvals?limit=20 (yoai_pending_approvals).

   Salt okunur; aksiyon kartları AiAdSuggestions'da.
   Detay bilgileri (teknik alanlar) kart altındaki "Detay" bölümünde.
   ────────────────────────────────────────────────────────── */

import { useEffect, useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Inbox,
  Clock,
  CheckCircle2,
  X,
  PauseCircle,
  Pencil,
  AlertTriangle,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { translateEnum, type Locale } from '@/lib/yoai/translations'

type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'hold'
  | 'editing'
  | 'published'
  | 'failed'
  | 'expired'

interface DecisionBadge {
  finalDecision: string | null
  confidence: number
  riskLevel: string | null
  requiresHumanReview: boolean
  requiredHumanChecksCount: number
  status: string
}

interface ApprovalRecord {
  id: string
  proposal_id: string
  platform: string
  source_campaign_id: string | null
  campaign_type: string | null
  status: ApprovalStatus
  status_reason: string | null
  rejection_reason: string | null
  hold_reason: string | null
  published_at: string | null
  publish_audit_id: string | null
  created_at: string
  updated_at: string
  metadata?: Record<string, unknown>
  decision_badge?: DecisionBadge | null
  proposal_snapshot: {
    campaignName?: string
    headline?: string
    objectiveLabel?: string
    callToAction?: string
    dailyBudget?: number
  } | null
}

// Ret/bekletme kategorileri — app-içi enum, kullanıcı etiketi i18n'den gelir.
const REJECTION_CATEGORY_KEYS: Record<string, string> = {
  'yanlış_kampanya_türü': 'wrongCampaignType',
  'düşük_kalite': 'lowQuality',
  'bütçe_uygunsuz': 'budgetUnsuitable',
  'kreatif_uygunsuz': 'creativeUnsuitable',
  'hedefleme_uygunsuz': 'targetingUnsuitable',
  'marka_dili_uygunsuz': 'brandToneUnsuitable',
  'politika_riski': 'policyRisk',
  'diğer': 'other',
}

const HOLD_CATEGORY_KEYS: Record<string, string> = {
  'daha_sonra': 'later',
  'müşteri_onayı_bekliyor': 'awaitingClientApproval',
  'bütçe_bekliyor': 'awaitingBudget',
  'kreatif_bekliyor': 'awaitingCreative',
  'veri_yetersiz': 'insufficientData',
  'diğer': 'other',
}

const DECISION_BADGE_KEYS: Record<string, string> = {
  publish_ready: 'publishReady',
  needs_edit: 'needsEdit',
  reject: 'reject',
  hold: 'hold',
  needs_human_review: 'needsHumanReview',
}

const DECISION_BADGE_CLASSES: Record<string, string> = {
  publish_ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  needs_edit: 'bg-primary/5 text-primary border-primary/20',
  reject: 'bg-red-50 text-red-700 border-red-200',
  hold: 'bg-gray-100 text-gray-600 border-gray-200',
  needs_human_review: 'bg-gray-50 text-gray-700 border-gray-200',
}

const OUTCOME_META: Record<
  string,
  { labelKey: string; classes: string; icon: typeof TrendingUp }
> = {
  improved: { labelKey: 'improved', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: TrendingUp },
  declined: { labelKey: 'declined', classes: 'bg-red-50 text-red-700 border-red-200', icon: TrendingDown },
  no_change: { labelKey: 'noChange', classes: 'bg-gray-100 text-gray-600 border-gray-200', icon: Minus },
  insufficient_data: { labelKey: 'insufficientData', classes: 'bg-gray-50 text-gray-500 border-gray-200', icon: Minus },
  pending: { labelKey: 'pendingResult', classes: 'bg-gray-50 text-gray-500 border-gray-200', icon: Clock },
}

interface Props {
  refreshKey?: number
}

const STATUS_META: Record<
  ApprovalStatus,
  { labelKey: string; icon: typeof Clock; classes: string }
> = {
  pending: {
    labelKey: 'pending',
    icon: Clock,
    classes: 'bg-primary/10 text-primary border-primary/20',
  },
  approved: {
    labelKey: 'approved',
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  published: {
    labelKey: 'published',
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    labelKey: 'rejected',
    icon: X,
    classes: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  hold: {
    labelKey: 'hold',
    icon: PauseCircle,
    classes: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  editing: {
    labelKey: 'editing',
    icon: Pencil,
    classes: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  failed: {
    labelKey: 'failed',
    icon: AlertTriangle,
    classes: 'bg-red-50 text-red-700 border-red-200',
  },
  expired: {
    labelKey: 'expired',
    icon: Clock,
    classes: 'bg-gray-100 text-gray-500 border-gray-200',
  },
}

function formatTime(iso: string | null, locale: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

interface OutcomeResult {
  outcome: string
  outcome_summary: string | null
  proposal_id: string
}

export default function ApprovalHistoryPanel({ refreshKey }: Props) {
  const t = useTranslations('dashboard.yoai.approvalHistory')
  const [records, setRecords] = useState<ApprovalRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [outcomeMap, setOutcomeMap] = useState<Record<string, OutcomeResult>>({})

  const fetchOutcomeForApproval = useCallback(async (rec: ApprovalRecord) => {
    if (!rec.proposal_id || outcomeMap[rec.proposal_id]) return
    try {
      const res = await fetch(
        `/api/yoai/results?limit=1${rec.source_campaign_id ? `&sourceCampaignId=${encodeURIComponent(rec.source_campaign_id)}` : ''}`,
        { credentials: 'include' },
      )
      if (!res.ok) return
      const json = await res.json()
      if (json.ok && Array.isArray(json.data) && json.data.length > 0) {
        const row = json.data[0]
        setOutcomeMap((prev) => ({
          ...prev,
          [rec.proposal_id]: {
            outcome: row.outcome,
            outcome_summary: row.outcome_summary,
            proposal_id: rec.proposal_id,
          },
        }))
      }
    } catch {
      // non-fatal
    }
  }, [outcomeMap])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/yoai/approvals?limit=20', {
        credentials: 'include',
      })
      if (!res.ok) {
        setRecords([])
        return
      }
      const json = await res.json()
      if (json.ok && Array.isArray(json.data)) {
        setRecords(json.data as ApprovalRecord[])
      } else {
        setRecords([])
      }
    } catch (e) {
      console.warn('[ApprovalHistoryPanel] fetch failed (non-fatal):', e)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory, refreshKey])

  if (loading && !records) {
    return null
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <History className="w-4 h-4 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
          {records && records.length > 0 && (
            <span className="text-[12px] text-gray-500">{t('recentCount', { count: records.length })}</span>
          )}
        </div>
        <p className="text-[13px] text-gray-500 leading-relaxed">
          {t('description')}
        </p>
      </div>

      {(!records || records.length === 0) ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {t('empty')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {records.map((rec) => (
            <ApprovalCard
              key={rec.id}
              rec={rec}
              expanded={expandedId === rec.id}
              outcomeResult={outcomeMap[rec.proposal_id]}
              onToggleDetail={() => {
                const next = expandedId === rec.id ? null : rec.id
                setExpandedId(next)
                if (next) fetchOutcomeForApproval(rec)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CardProps {
  rec: ApprovalRecord
  expanded: boolean
  outcomeResult: OutcomeResult | undefined
  onToggleDetail: () => void
}

function ApprovalCard({ rec, expanded, outcomeResult, onToggleDetail }: CardProps) {
  const t = useTranslations('dashboard.yoai.approvalHistory')
  const locale = useLocale() as Locale
  const plat: 'meta' | 'google' = rec.platform?.toLowerCase() === 'google' ? 'google' : 'meta'
  const meta = STATUS_META[rec.status] || STATUS_META.pending
  const Icon = meta.icon

  const title =
    rec.proposal_snapshot?.campaignName ||
    rec.proposal_snapshot?.headline ||
    t('untitledProposal')

  const reason = rec.rejection_reason || rec.hold_reason || rec.status_reason || null
  const rejectionCategory = rec.metadata?.rejection_category as string | null | undefined
  const holdCategory = rec.metadata?.hold_category as string | null | undefined
  const badge = rec.decision_badge
  const badgeDecision = badge?.finalDecision
  const badgeClass = badgeDecision
    ? (DECISION_BADGE_CLASSES[badgeDecision] ?? 'bg-gray-50 text-gray-500 border-gray-200')
    : null
  const outcomeMeta = outcomeResult ? OUTCOME_META[outcomeResult.outcome] : null
  const OutcomeIcon = outcomeMeta?.icon

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      {/* Card header */}
      <div className="p-4 flex-1">
        {/* Top badges row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium ${meta.classes}`}
          >
            <Icon className="w-3 h-3" />
            {t(`status.${meta.labelKey}`)}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-600 uppercase tracking-wide">
            {rec.platform}
          </span>
          {badgeDecision && badgeClass && (
            <span
              className={`inline-flex items-center px-2 py-1 rounded-lg border text-[11px] font-medium ${badgeClass}`}
            >
              {t('aiPrefix')} {DECISION_BADGE_KEYS[badgeDecision] ? t(`decisionBadge.${DECISION_BADGE_KEYS[badgeDecision]}`) : badgeDecision}
            </span>
          )}
          {outcomeMeta && OutcomeIcon && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium ${outcomeMeta.classes}`}
            >
              <OutcomeIcon className="w-3 h-3" />
              {t(`outcome.${outcomeMeta.labelKey}`)}
            </span>
          )}
        </div>

        {/* Campaign name */}
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">
          {title}
        </p>

        {/* Key details */}
        <div className="space-y-1.5">
          {rec.proposal_snapshot?.objectiveLabel && (
            <InfoRow label={t('fields.objective')} value={rec.proposal_snapshot.objectiveLabel} />
          )}
          {rec.proposal_snapshot?.dailyBudget != null && (
            <InfoRow label={t('fields.dailyBudget')} value={`₺${rec.proposal_snapshot.dailyBudget}`} />
          )}
          {rec.proposal_snapshot?.headline && (
            <InfoRow label={t('fields.headline')} value={rec.proposal_snapshot.headline} truncate />
          )}
          {rec.proposal_snapshot?.callToAction && (
            <InfoRow label={t('fields.cta')} value={translateEnum(rec.proposal_snapshot.callToAction, locale, plat)} />
          )}
          {reason && (
            <InfoRow label={t('fields.reason')} value={reason} truncate />
          )}
          {(rejectionCategory || holdCategory) && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {rejectionCategory && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-medium">
                  {REJECTION_CATEGORY_KEYS[rejectionCategory] ? t(`rejectionCategory.${REJECTION_CATEGORY_KEYS[rejectionCategory]}`) : rejectionCategory}
                </span>
              )}
              {holdCategory && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-50 text-gray-600 border border-gray-200 text-[11px] font-medium">
                  {HOLD_CATEGORY_KEYS[holdCategory] ? t(`holdCategory.${HOLD_CATEGORY_KEYS[holdCategory]}`) : holdCategory}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Date */}
        <p className="text-[11px] text-gray-400 mt-3">
          {formatTime(rec.updated_at || rec.created_at, locale)}
          {rec.published_at && (
            <span className="text-emerald-500 ml-2">{t('publishedAt', { time: formatTime(rec.published_at, locale) })}</span>
          )}
        </p>
      </div>

      {/* Expanded details — user-facing only, no technical IDs */}
      {expanded && (
        <div className="mx-3 mb-3 rounded-xl bg-gray-50/60 border border-gray-100 px-3 py-3">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">{t('details')}</p>
          <div className="space-y-1.5">
            {rec.proposal_snapshot?.headline && (
              <DetailRow label={t('fields.headline')} value={rec.proposal_snapshot.headline} />
            )}
            {rec.proposal_snapshot?.objectiveLabel && (
              <DetailRow label={t('fields.objective')} value={rec.proposal_snapshot.objectiveLabel} />
            )}
            {rec.proposal_snapshot?.dailyBudget != null && (
              <DetailRow label={t('fields.dailyBudget')} value={`₺${rec.proposal_snapshot.dailyBudget}`} />
            )}
            {rec.proposal_snapshot?.callToAction && (
              <DetailRow label={t('fields.cta')} value={translateEnum(rec.proposal_snapshot.callToAction, locale, plat)} />
            )}
            {reason && (
              <DetailRow label={t('fields.reason')} value={reason} />
            )}
            {outcomeResult?.outcome_summary && (
              <DetailRow label={t('fields.outcomeNote')} value={outcomeResult.outcome_summary} />
            )}
            {badge?.confidence != null && badge.confidence > 0 && (
              <DetailRow label={t('fields.aiConfidence')} value={`${badge.confidence}%`} />
            )}
            <DetailRow label={t('fields.createdAt')} value={formatTime(rec.created_at, locale)} />
            <DetailRow label={t('fields.updatedAt')} value={formatTime(rec.updated_at, locale)} />
            {/* proposal_id, publish_audit_id, source_campaign_id: admin/debug only — not shown here */}
          </div>
        </div>
      )}

      {/* Card footer actions */}
      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-end">
        <button
          onClick={onToggleDetail}
          className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-primary transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              {t('hideDetails')}
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              {t('showDetails')}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap" style={{ minWidth: '5.5rem' }}>{label}</span>
      <span className={`text-[12px] text-gray-700 flex-1 min-w-0 ${truncate ? 'truncate' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[12px]">
      <span className="text-gray-400 shrink-0 whitespace-nowrap" style={{ minWidth: '5.5rem' }}>{label}</span>
      <span className="text-gray-600 flex-1 min-w-0 break-words">{value}</span>
    </div>
  )
}
