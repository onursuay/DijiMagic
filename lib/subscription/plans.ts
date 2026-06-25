import type { SubscriptionPlan, CreditPackage } from './types'

/**
 * Plan fiyatları USD ($) cinsindendir — kullanıcıya ABD doları gösterilir.
 * İyzico TL tahsil ettiği için ödeme anında bu rakamlar `USD_TRY_RATE` ile TL'ye
 * çevrilir (bkz. `toChargeTRY` + lib/billing/catalog.ts). Buradaki sayılar her
 * zaman GÖSTERİLEN (USD) fiyatlardır; tahsil edilen TL değil.
 *
 * Konumlandırma: doğrudan rakip iyzads ($49/$99/$199) her kademede ~%20 altından
 * fiyatlanır → "iyzads'ın sunduğu her şey, daha fazla modülle, daha ucuza".
 */
const ACCOUNT_PRICES: Record<string, Record<number, number>> = {
  basic:   { 2: 39, 3: 54, 4: 69, 5: 84 },
  starter: { 2: 79, 3: 109, 4: 139, 5: 169 },
  premium: { 2: 159, 3: 229, 4: 299, 5: 369 },
}

/** Per-extra-account cost (USD) for accounts beyond the lookup table */
const EXTRA_ACCOUNT_COST: Record<string, number> = {
  basic: 15,
  starter: 30,
  premium: 70,
}

/** Yearly discount multiplier (30% off) */
export const YEARLY_DISCOUNT = 0.70

/**
 * Manuel yönetilen USD→TRY kuru. Canlı kur yerine sabit + küçük tampon kullanılır
 * (checkout anında fiyat oynamasın, marj korunsun). Periyodik güncellenir.
 * Gösterilen fiyat USD; İyzico'ya giden tutar = USD × USD_TRY_RATE (TL).
 */
export const USD_TRY_RATE = 47

/** USD gösterim fiyatını İyzico'ya gönderilecek TL tutarına (2 ondalık) çevirir. */
export function toChargeTRY(usd: number): number {
  return Math.round(usd * USD_TRY_RATE * 100) / 100
}

/** Ad-account count bounds for the self-serve plans (Basic / Starter / Premium) */
export const MIN_AD_ACCOUNTS = 2
export const MAX_AD_ACCOUNTS = 6
/** Enterprise is contact-sales and starts where the self-serve plans cap out (7+) */
export const ENTERPRISE_MIN_AD_ACCOUNTS = 7
export const ENTERPRISE_MAX_AD_ACCOUNTS = 50

/**
 * Get monthly price (USD) for a plan based on ad account count.
 */
export function getMonthlyPrice(planId: string, adAccounts: number): number {
  const prices = ACCOUNT_PRICES[planId]
  if (!prices) return 0

  if (prices[adAccounts] !== undefined) {
    return prices[adAccounts]
  }

  // Extrapolate for counts beyond the table
  const maxDefined = Math.max(...Object.keys(prices).map(Number))
  const basePrice = prices[maxDefined]
  const extra = adAccounts - maxDefined
  return basePrice + extra * (EXTRA_ACCOUNT_COST[planId] || 15)
}

/**
 * Get yearly price (USD) for a plan (30% discount).
 */
export function getYearlyPrice(planId: string, adAccounts: number): number {
  const monthly = getMonthlyPrice(planId, adAccounts)
  return Math.round(monthly * 12 * YEARLY_DISCOUNT * 100) / 100
}

/**
 * Get per-month price (USD) when billing yearly.
 */
export function getYearlyMonthlyPrice(planId: string, adAccounts: number): number {
  const yearly = getYearlyPrice(planId, adAccounts)
  return Math.round(yearly / 12 * 100) / 100
}

/**
 * Plan özellik anahtarları — i18n key'leri (subscription.featureLabels.*).
 * Ham metin değil; UI bunları `t()` ile çevirir (EN/TR uyumu zorunlu).
 * Kademe dağılımı (onaylı):
 *  - Basic   : reklam yönetimi + raporlar + temel hedef kitle + tasarım
 *  - Starter : + Optimizasyon + AI Hedef Kitle + SEO Plus
 *  - Premium : + AI Strateji + DijiAlgoritma + CRM + Email Marketing + Dönüşüm Sihirbazı
 *  - Enterprise: hepsi sınırsız + sınırsız reklam hesabı
 */
const BASIC_FEATURES = [
  'reklamYonetimi',
  'raporlar',
  'hedefKitle',
  'tasarim',
  'entegrasyon',
]

const STARTER_FEATURES = [
  'optimizasyon',
  'hedefKitleAI',
  'seoPlus',
  'reklamYonetimi',
  'raporlar',
  'tasarim',
]

const PREMIUM_FEATURES = [
  'aiStrateji',
  'dijiAlgoritma',
  'crm',
  'emailMarketing',
  'donusumSihirbazi',
  'optimizasyon',
  'hedefKitleAI',
  'seoPlus',
]

const ENTERPRISE_FEATURES = [
  'aiStratejiSinirsiz',
  'dijiAlgoritma',
  'crm',
  'emailMarketing',
  'donusumSihirbazi',
  'optimizasyon',
  'seoPlus',
  'sinirsizHesap',
]

/** Feature section titles per plan */
export const PLAN_SECTION_TITLES: Record<string, string> = {
  basic: 'Tek Panelden Yönetin',
  starter: 'Profesyonel Reklam Yönetimi',
  premium: 'Tam Pazarlama Suite’i',
  enterprise: 'Sınırsız Reklam Gücü',
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 39,
    yearlyPrice: 327.60,
    features: BASIC_FEATURES,
    adAccountLimit: 2,
    includesOptimization: false,
    aiScanDailyLimit: 3,
    strategyMonthlyLimit: 1,
    trialDays: 0,
  },
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 79,
    yearlyPrice: 663.60,
    features: STARTER_FEATURES,
    adAccountLimit: 2,
    includesOptimization: true,
    aiScanDailyLimit: 3,
    strategyMonthlyLimit: 3,
    trialDays: 0,
  },
  {
    id: 'premium',
    name: 'Premium',
    monthlyPrice: 159,
    yearlyPrice: 1335.60,
    features: PREMIUM_FEATURES,
    adAccountLimit: 2,
    includesOptimization: true,
    aiScanDailyLimit: 10,
    strategyMonthlyLimit: 10,
    trialDays: 14,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ENTERPRISE_FEATURES,
    adAccountLimit: 7,
    includesOptimization: true,
    aiScanDailyLimit: -1,
    strategyMonthlyLimit: -1,
    trialDays: 14,
  },
]

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'pkg-100', credits: 100, price: 9, label: '100 Kredi' },
  { id: 'pkg-500', credits: 500, price: 39, label: '500 Kredi', popular: true },
  { id: 'pkg-1000', credits: 1000, price: 69, label: '1.000 Kredi' },
]
