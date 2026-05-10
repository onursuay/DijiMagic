'use client'

import {
  Flag,
  DollarSign,
  Settings2,
  Users,
  Sparkles,
  Megaphone,
  ClipboardList,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { WizardState } from './WizardTypes'
import { LANGUAGE_OPTIONS } from './WizardTypes'
import { GoogleWizardSummaryCard, GoogleWizardSummaryRow } from './GoogleWizardUI'

interface Props {
  state: WizardState
  currentStep: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}

/**
 * Search wizard — sağ readonly özet paneli.
 * Display wizard'ın DisplaySidebar tasarım dilini birebir paylaşır.
 * State okumadan başka bir şey yapmaz; validation/payload'a dokunmaz.
 */
export default function SearchSummaryPanel({ state, currentStep, t }: Props) {
  const notSet = '—'

  // Step 0 — Goal & Campaign Type
  const goalLabel = (() => {
    try { return t(`goal.labels.${state.campaignGoal}`) } catch { return state.campaignGoal }
  })()
  const typeLabel = (() => {
    switch (state.campaignType) {
      case 'SEARCH': return t('display.campaignTypeSearch')
      case 'DISPLAY': return t('display.campaignTypeDisplay')
      case 'PERFORMANCE_MAX': return t('display.campaignTypePerformanceMax')
      case 'VIDEO': return t('display.campaignTypeVideo')
      case 'SHOPPING': return t('display.campaignTypeShopping')
      case 'DEMAND_GEN': return t('display.campaignTypeDemandGen')
      case 'MULTI_CHANNEL': return t('display.campaignTypeApp')
      default: return state.campaignType
    }
  })()
  const goalComplete = !!state.campaignGoal && !!state.campaignType

  // Step 1 — Conversion & Name
  const campaignNameComplete = state.campaignName.trim().length > 0
  const conversionGoalCount = state.selectedConversionGoalIds.length

  // Step 2 — Bidding
  const biddingLabel = (() => {
    try { return t(`summary.biddingLabels.${state.biddingStrategy}`) } catch { return state.biddingStrategy }
  })()
  const biddingComplete = !!state.biddingStrategy

  // Step 3 — Campaign Settings
  const langNames = state.languageIds
    .map(id => LANGUAGE_OPTIONS.find(l => l.id === id)?.name ?? id)
    .join(', ')
  const locParts = [
    ...state.locations.map(l => `${l.name}${l.isNegative ? ` (${t('location.excludedParens')})` : ''}`),
    ...state.proximityTargets.map(p => p.label ?? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`),
  ]
  const locSummary = locParts.length > 0
    ? (locParts.length > 2 ? `${locParts.slice(0, 2).join(', ')} +${locParts.length - 2}` : locParts.join(', '))
    : t('summary.locationDefault')
  const euPoliticalLabel = state.euPoliticalAdsDeclaration === 'POLITICAL'
    ? t('settings.euPoliticalPolitical')
    : t('settings.euPoliticalNotPolitical')
  const settingsComplete = state.languageIds.length > 0

  // Step 4 — AI Max
  const aiMaxLabel = state.aiMax.enabled ? t('display.summaryReadyLabel') : notSet
  const aiMaxComplete = true // step optional

  // Step 5 — Keywords & Ads (RSA)
  const keywordCount = state.keywordsRaw
    .split('\n')
    .map(k => k.trim())
    .filter(Boolean).length
  const headlineCount = state.headlines.map(h => h.trim()).filter(Boolean).length
  const descCount = state.descriptions.map(d => d.trim()).filter(Boolean).length
  const finalUrlSet = !!state.finalUrl && state.finalUrl !== 'https://'
  const adsComplete = headlineCount >= 3 && descCount >= 2 && finalUrlSet && keywordCount >= 1

  // Step 6 — Budget
  const budgetSet = !!state.dailyBudget && Number(state.dailyBudget) > 0

  // Overall readiness
  const allReady =
    goalComplete &&
    campaignNameComplete &&
    biddingComplete &&
    settingsComplete &&
    adsComplete &&
    budgetSet

  return (
    <div className="sticky top-8 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {t('display.summarySidebarTitle')}
      </h3>

      <GoogleWizardSummaryCard
        icon={<Flag className="w-4 h-4" />}
        title={t('display.summaryGoal')}
        active={currentStep === 0}
        complete={goalComplete}
      >
        <GoogleWizardSummaryRow label={t('summary.rowCampaignGoal')} value={goalLabel} />
        <GoogleWizardSummaryRow label={t('summary.rowCampaignType')} value={typeLabel} />
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<Flag className="w-4 h-4" />}
        title={t('conversion.title')}
        active={currentStep === 1}
        complete={campaignNameComplete}
      >
        <GoogleWizardSummaryRow
          label={t('summary.campaign')}
          value={state.campaignName.trim() || notSet}
          muted={!campaignNameComplete}
        />
        <GoogleWizardSummaryRow
          label={t('display.summaryGoal')}
          value={conversionGoalCount > 0 ? `${conversionGoalCount}` : notSet}
          muted={conversionGoalCount === 0}
        />
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<DollarSign className="w-4 h-4" />}
        title={t('display.summaryBidStrategy')}
        active={currentStep === 2}
        complete={biddingComplete}
      >
        <GoogleWizardSummaryRow label={t('display.summaryBidStrategy')} value={biddingLabel} />
        {state.biddingStrategy === 'TARGET_CPA' && (
          <GoogleWizardSummaryRow
            label={t('summary.targetCpa')}
            value={state.targetCpa ? `${state.targetCpa} TRY` : notSet}
            muted={!state.targetCpa}
          />
        )}
        {state.biddingStrategy === 'TARGET_ROAS' && (
          <GoogleWizardSummaryRow
            label={t('summary.targetRoas')}
            value={state.targetRoas ? `%${state.targetRoas}` : notSet}
            muted={!state.targetRoas}
          />
        )}
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<Settings2 className="w-4 h-4" />}
        title={t('display.summaryGeoLangEu')}
        active={currentStep === 3}
        complete={settingsComplete}
      >
        <GoogleWizardSummaryRow label={t('summary.locations')} value={locSummary} />
        <GoogleWizardSummaryRow label={t('settings.languagesTitle')} value={langNames || notSet} />
        <GoogleWizardSummaryRow label={t('settings.euPoliticalTitle')} value={euPoliticalLabel} />
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<Sparkles className="w-4 h-4" />}
        title={t('steps.aiMax')}
        active={currentStep === 4}
        complete={aiMaxComplete}
      >
        <GoogleWizardSummaryRow
          label={t('steps.aiMax')}
          value={aiMaxLabel}
          muted={!state.aiMax.enabled}
        />
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<Megaphone className="w-4 h-4" />}
        title={t('display.summaryAd')}
        active={currentStep === 5}
        complete={adsComplete}
      >
        <GoogleWizardSummaryRow
          label={t('summary.finalUrl')}
          value={finalUrlSet ? state.finalUrl : notSet}
          muted={!finalUrlSet}
        />
        <GoogleWizardSummaryRow
          label={t('adgroup.keywordsSectionTitle')}
          value={`${keywordCount}`}
          muted={keywordCount === 0}
        />
        <GoogleWizardSummaryRow
          label={t('display.summaryHeadlineCount')}
          value={`${headlineCount}/15`}
          muted={headlineCount === 0}
        />
        <GoogleWizardSummaryRow
          label={t('display.summaryDescriptionCount')}
          value={`${descCount}/4`}
          muted={descCount === 0}
        />
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<Users className="w-4 h-4" />}
        title={t('summary.dailyBudget')}
        active={currentStep === 6}
        complete={budgetSet}
      >
        <GoogleWizardSummaryRow
          label={t('summary.dailyBudget')}
          value={budgetSet ? `${state.dailyBudget} TRY` : notSet}
          muted={!budgetSet}
        />
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<ClipboardList className="w-4 h-4" />}
        title={t('steps.summary')}
        active={currentStep === 7}
        complete={allReady}
      >
        <div className="flex items-center gap-2 text-xs">
          {allReady ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-700 font-medium">{t('display.summaryReadyLabel')}</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600 font-medium">{t('display.summaryMissingLabel')}</span>
            </>
          )}
        </div>
      </GoogleWizardSummaryCard>
    </div>
  )
}
