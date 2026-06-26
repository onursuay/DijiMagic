/**
 * Server-only billing catalog — single source of truth for all monetary values.
 *
 * WARNING: Nothing here may be computed from client input. The start endpoint
 * receives only `planId` / `packageId` / `billingCycle` / `adAccounts` and
 * re-derives price, credits, and duration from these tables.
 */

import 'server-only'
import { getMonthlyPrice, getYearlyPrice, toChargeTRY } from '@/lib/subscription/plans'
import type { BillingCycle, PlanId } from '@/lib/subscription/types'

/**
 * Para birimi sözleşmesi:
 *  - `amountUsd`  : kullanıcıya GÖSTERİLEN fiyat (USD). Kayıt/teşhis amaçlı.
 *  - `amount`     : İyzico'ya gönderilen ve tahsil edilen NİHAİ tutar (TL).
 *                   = toChargeTRY(amountUsd). callback bu değeri yeniden türetip
 *                   `paidPrice` ile karşılaştırır — deterministik olmalı.
 *  - `currency`   : İyzico TL tahsil eder → her zaman 'TRY'.
 */
export interface PricedSubscription {
  planId: PlanId
  billingCycle: BillingCycle
  adAccounts: number
  amount: number
  amountUsd: number
  currency: 'TRY'
  periodDays: number
  trialDays: number
  bundledCredits: number
}

export interface PricedCreditPack {
  packageId: string
  credits: number
  amount: number
  amountUsd: number
  currency: 'TRY'
}

const SUBSCRIPTION_PLAN_IDS: PlanId[] = ['basic', 'starter', 'premium']

// Plana dahil aylık kredi. Rakip-hizalı (iyzads 20/60/100); DijiMagic daha fazla
// kredi-tüketen modül paketlediği için (DijiAlgoritma sohbet, Tasarım, Strateji
// aşımı) cömert tutulur. Overflow için kredi paketleri ayrıca satılır.
const BUNDLED_CREDITS: Record<string, number> = {
  basic: 50,
  starter: 150,
  premium: 500,
}

const TRIAL_DAYS: Record<string, number> = {
  basic: 0,
  starter: 0,
  premium: 7,
}

// Kredi paketi GÖSTERİM fiyatları (USD). Tahsil TL = toChargeTRY(amountUsd).
const CREDIT_PACKAGES: Record<string, { credits: number; amountUsd: number }> = {
  'pkg-100':  { credits: 100,  amountUsd: 9 },
  'pkg-500':  { credits: 500,  amountUsd: 39 },
  'pkg-1000': { credits: 1000, amountUsd: 69 },
}

/**
 * Price a subscription purchase. Returns null for unsupported plans
 * (free is not purchasable; enterprise is contact-sales only).
 */
export function priceSubscription(
  planId: string,
  billingCycle: string,
  adAccountsRaw: number | undefined,
): PricedSubscription | null {
  if (!SUBSCRIPTION_PLAN_IDS.includes(planId as PlanId)) return null
  if (billingCycle !== 'monthly' && billingCycle !== 'yearly') return null

  const adAccounts = Math.max(2, Math.min(50, Math.floor(adAccountsRaw ?? 2)))
  const amountUsd = billingCycle === 'monthly'
    ? getMonthlyPrice(planId, adAccounts)
    : getYearlyPrice(planId, adAccounts)

  if (!amountUsd || amountUsd <= 0) return null

  return {
    planId: planId as PlanId,
    billingCycle: billingCycle as BillingCycle,
    adAccounts,
    amount: toChargeTRY(amountUsd),
    amountUsd,
    currency: 'TRY',
    periodDays: billingCycle === 'monthly' ? 30 : 365,
    trialDays: TRIAL_DAYS[planId] ?? 0,
    bundledCredits: BUNDLED_CREDITS[planId] ?? 0,
  }
}

export function priceCreditPack(packageId: string): PricedCreditPack | null {
  const pkg = CREDIT_PACKAGES[packageId]
  if (!pkg) return null
  return {
    packageId,
    credits: pkg.credits,
    amount: toChargeTRY(pkg.amountUsd),
    amountUsd: pkg.amountUsd,
    currency: 'TRY',
  }
}
