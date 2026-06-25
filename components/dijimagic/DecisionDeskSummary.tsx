'use client'

/* ──────────────────────────────────────────────────────────
   DijiAlgoritma — Decision Desk Summary (Faz 5)

   Multi-AI Judge kararını kullanıcıya sade ve readonly olarak
   gösterir. Publish trigger etmez.

   Veri kaynağı: dijimagic_model_decisions DB satırları (role bazlı).
   ────────────────────────────────────────────────────────── */

import { useTranslations } from 'next-intl'

const JUDGE_DECISION_KEYS: Record<string, string> = {
  publish_ready: 'publishReady',
  needs_edit: 'needsEdit',
  reject: 'reject',
  hold: 'hold',
  needs_human_review: 'needsHumanReview',
}

const JUDGE_DECISION_CLASSES: Record<string, string> = {
  publish_ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  needs_edit: 'bg-primary/5 text-primary border-primary/20',
  reject: 'bg-red-50 text-red-700 border-red-200',
  hold: 'bg-gray-100 text-gray-600 border-gray-200',
  needs_human_review: 'bg-gray-50 text-gray-700 border-gray-200',
}

const ROLE_KEYS: Record<string, string> = {
  strategist: 'strategist',
  creative: 'creative',
  risk_policy: 'riskPolicy',
  technical_validator: 'technical',
  judge: 'judge',
}

const STATUS_DOT: Record<string, string> = {
  success: 'bg-emerald-400',
  failed: 'bg-red-400',
  skipped: 'bg-gray-300',
  timeout: 'bg-gray-400',
  disabled: 'bg-gray-200',
  skipped_cost_guard: 'bg-gray-300',
}

const ALL_ROLES = ['strategist', 'creative', 'risk_policy', 'technical_validator', 'judge']

export interface DecisionSummaryRow {
  role: string
  provider: string
  status: string
  confidence: number
  risk_level: string | null
  publish_ready: boolean
  requires_human_review: boolean
  output_json: Record<string, unknown>
}

interface Props {
  rows: DecisionSummaryRow[] | null
  loading?: boolean
}

export default function DecisionDeskSummary({ rows, loading }: Props) {
  const t = useTranslations('dashboard.dijimagic.decisionDesk')

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-[12px] text-gray-400">
        {t('loading')}
      </div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-[12px] text-gray-500">
        {t('empty')}{' '}
        <span className="text-gray-400">
          {t('emptyHint')}
        </span>
      </div>
    )
  }

  const judgeRow = rows.find((r) => r.role === 'judge')
  const roleMap = new Map(rows.map((r) => [r.role, r]))

  const finalDecision =
    typeof judgeRow?.output_json?.finalDecision === 'string'
      ? judgeRow.output_json.finalDecision
      : null
  const finalRecommendation =
    typeof judgeRow?.output_json?.finalRecommendation === 'string'
      ? judgeRow.output_json.finalRecommendation
      : null
  const finalCreativeBrief =
    typeof judgeRow?.output_json?.finalCreativeBrief === 'string'
      ? judgeRow.output_json.finalCreativeBrief
      : null
  const finalPayloadNotes =
    typeof judgeRow?.output_json?.finalPayloadNotes === 'string'
      ? judgeRow.output_json.finalPayloadNotes
      : null
  const unresolvedRisks = Array.isArray(judgeRow?.output_json?.unresolvedRisks)
    ? (judgeRow!.output_json.unresolvedRisks as string[])
    : []
  const requiredHumanChecks = Array.isArray(judgeRow?.output_json?.requiredHumanChecks)
    ? (judgeRow!.output_json.requiredHumanChecks as string[])
    : []
  const campaignTypeFidelity =
    judgeRow?.output_json?.campaignTypeFidelity === true
      ? true
      : judgeRow?.output_json?.campaignTypeFidelity === false
        ? false
        : null

  const decisionClass = finalDecision
    ? (JUDGE_DECISION_CLASSES[finalDecision] ?? 'bg-gray-50 text-gray-700 border-gray-200')
    : 'bg-gray-50 text-gray-500 border-gray-200'
  const decisionLabel = finalDecision
    ? (JUDGE_DECISION_KEYS[finalDecision] ? t(`decision.${JUDGE_DECISION_KEYS[finalDecision]}`) : finalDecision)
    : t('noDecision')

  return (
    <div className="space-y-3">
      {/* Başlık + judge kararı */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
          {t('title')}
        </span>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[12px] font-semibold ${decisionClass}`}
        >
          {decisionLabel}
        </span>
        {judgeRow && (
          <>
            <span className="text-[11px] text-gray-500">{t('confidence', { value: judgeRow.confidence })}</span>
            {judgeRow.risk_level && (
              <span className="text-[11px] text-gray-500">{t('risk', { level: judgeRow.risk_level })}</span>
            )}
            {campaignTypeFidelity !== null && (
              <span
                className={`text-[11px] ${campaignTypeFidelity ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {t('campaignTypeFidelity', { value: campaignTypeFidelity ? t('compatible') : t('incompatible') })}
              </span>
            )}
          </>
        )}
      </div>

      {/* Rol durumları */}
      <div className="flex items-center gap-3 flex-wrap">
        {ALL_ROLES.map((role) => {
          const row = roleMap.get(role)
          const dotClass = row ? (STATUS_DOT[row.status] ?? 'bg-gray-300') : 'bg-gray-200'
          return (
            <div key={role} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
              <span className="text-[11px] text-gray-600">{ROLE_KEYS[role] ? t(`roles.${ROLE_KEYS[role]}`) : role}</span>
              <span className="text-[10px] text-gray-400">{row ? row.status : t('none')}</span>
            </div>
          )
        })}
      </div>

      {/* Final öneri */}
      {finalRecommendation && (
        <div className="bg-gray-50 rounded-xl px-3 py-2 text-[12px] text-gray-700">
          <p className="font-semibold text-gray-500 text-[11px] uppercase tracking-wide mb-1">
            {t('finalRecommendation')}
          </p>
          <p className="leading-relaxed">{finalRecommendation}</p>
        </div>
      )}

      {/* Kreatif brief */}
      {finalCreativeBrief && (
        <div className="bg-gray-50 rounded-xl px-3 py-2 text-[12px] text-gray-700">
          <p className="font-semibold text-gray-500 text-[11px] uppercase tracking-wide mb-1">
            {t('creativeBrief')}
          </p>
          <p className="leading-relaxed">{finalCreativeBrief}</p>
        </div>
      )}

      {/* Payload notları */}
      {finalPayloadNotes && (
        <div className="bg-gray-50 rounded-xl px-3 py-2 text-[12px] text-gray-600">
          <p className="font-semibold text-gray-500 text-[11px] uppercase tracking-wide mb-1">
            {t('payloadNotes')}
          </p>
          <p className="leading-relaxed">{finalPayloadNotes}</p>
        </div>
      )}

      {/* İnsan kontrolü gereken */}
      {requiredHumanChecks.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {t('humanChecksRequired', { count: requiredHumanChecks.length })}
          </p>
          <ul className="space-y-0.5">
            {requiredHumanChecks.map((c, i) => (
              <li key={i} className="text-[12px] text-gray-700 flex items-start gap-1.5">
                <span className="text-gray-400 mt-0.5 shrink-0">›</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Çözülmemiş riskler */}
      {unresolvedRisks.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wide mb-1">
            {t('unresolvedRisks')}
          </p>
          <ul className="space-y-0.5">
            {unresolvedRisks.map((r, i) => (
              <li key={i} className="text-[12px] text-red-700 flex items-start gap-1.5">
                <span className="text-red-400 mt-0.5 shrink-0">›</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
