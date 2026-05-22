'use client'

import { Check, Minus, Plus } from 'lucide-react'
import type { SubscriptionPlan, BillingCycle } from '@/lib/subscription/types'
import { getMonthlyPrice, getYearlyPrice, getYearlyMonthlyPrice, PLAN_SECTION_TITLES, MIN_AD_ACCOUNTS, MAX_AD_ACCOUNTS, ENTERPRISE_MIN_AD_ACCOUNTS, ENTERPRISE_MAX_AD_ACCOUNTS } from '@/lib/subscription/plans'
import { useTranslations } from 'next-intl'

interface Props {
  plan: SubscriptionPlan
  billingCycle: BillingCycle
  isCurrentPlan: boolean
  onSelect: (planId: string) => void
  highlighted?: boolean
  adAccountCount: number
  onAccountChange: (count: number) => void
}

export default function PlanCard({ plan, billingCycle, isCurrentPlan, onSelect, highlighted, adAccountCount, onAccountChange }: Props) {
  const t = useTranslations('subscription')
  const isEnterprise = plan.id === 'enterprise'

  const accounts = adAccountCount
  const monthlyPrice = getMonthlyPrice(plan.id, accounts)
  const yearlyTotal = getYearlyPrice(plan.id, accounts)
  const yearlyMonthly = getYearlyMonthlyPrice(plan.id, accounts)
  const displayPrice = billingCycle === 'monthly' ? monthlyPrice : yearlyMonthly

  // Original monthly price (for strikethrough when yearly)
  const originalMonthlyTotal = monthlyPrice * 12

  const sectionTitle = PLAN_SECTION_TITLES[plan.id] || t('features')

  // Self-serve plans scale 2→6; Enterprise (contact-sales) starts at 7 and goes up.
  const minAccounts = isEnterprise ? ENTERPRISE_MIN_AD_ACCOUNTS : MIN_AD_ACCOUNTS
  const maxAccounts = isEnterprise ? ENTERPRISE_MAX_AD_ACCOUNTS : MAX_AD_ACCOUNTS

  const handleDecrease = () => {
    if (adAccountCount > minAccounts) {
      onAccountChange(adAccountCount - 1)
    }
  }

  const handleIncrease = () => {
    if (adAccountCount < maxAccounts) {
      onAccountChange(adAccountCount + 1)
    }
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all bg-gray-800 ${
        highlighted
          ? 'border-primary shadow-lg shadow-primary/20 ring-1 ring-primary/30'
          : 'border-gray-700 hover:border-gray-600'
      }`}
    >
      {/* Popular / Trial badge */}
      {highlighted && plan.trialDays > 0 ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
          {t('trialBadge')}
        </div>
      ) : highlighted ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
          {t('popular') ?? 'En Popüler'}
        </div>
      ) : null}

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white">{plan.name}</h3>
          {plan.trialDays > 0 && !highlighted && !isEnterprise && (
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-primary/20 text-primary rounded-full">
              {t('trialBadge')}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-1">
          {t(`planDescriptions.${plan.id}`)}
        </p>
      </div>

      {/* Price */}
      <div className="mb-5">
        {isEnterprise ? (
          <div className="text-lg font-bold text-white">
            {t('contactUs')}
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">${displayPrice.toFixed(2)}</span>
              <span className="text-sm text-gray-400">/ {billingCycle === 'yearly' ? 'ay' : t('perMonth')}</span>
            </div>
            {billingCycle === 'yearly' && (
              <p className="text-sm text-gray-500 mt-1">
                <span className="line-through">${originalMonthlyTotal.toFixed(2)}</span>
                {' '}${yearlyTotal.toFixed(2)}/yıl
              </p>
            )}
          </>
        )}
      </div>

      {/* Ad accounts */}
      <div className="mb-5 pb-5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrease}
            disabled={adAccountCount <= minAccounts}
            className={`p-1 rounded border transition-colors ${
              adAccountCount <= minAccounts
                ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                : 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 cursor-pointer'
            }`}
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-sm text-gray-300">
            {adAccountCount} {t('adAccounts')}
          </span>
          <button
            onClick={handleIncrease}
            disabled={adAccountCount >= maxAccounts}
            className={`p-1 rounded border transition-colors ${
              adAccountCount >= maxAccounts
                ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                : 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 cursor-pointer'
            }`}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        {/* Reserved hint slot — keeps every card the same height (symmetry) */}
        <div className="min-h-[18px] mt-1.5">
          {!isEnterprise && adAccountCount >= MAX_AD_ACCOUNTS && (
            <p className="text-xs text-primary">{t('maxAccountsHint')}</p>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-400 mb-3">{sectionTitle}</p>
        <ul className="space-y-2.5">
          {plan.features.map(feature => (
            <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
              <Check className="w-4 h-4 text-primary shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="mt-6">
        {isCurrentPlan ? (
          <div className="w-full py-2.5 text-center text-sm font-medium text-primary bg-primary/10 rounded-lg">
            {t('currentPlanBadge')}
          </div>
        ) : isEnterprise ? (
          <button
            onClick={() => onSelect(plan.id)}
            className="w-full py-2.5 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            {t('contactUs')}
          </button>
        ) : (
          <button
            onClick={() => onSelect(plan.id)}
            className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
              highlighted
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-white text-gray-900 hover:bg-gray-100'
            }`}
          >
            {t('selectPlan')}
          </button>
        )}
      </div>
    </div>
  )
}
