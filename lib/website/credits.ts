import type { SiteType } from './types'

/**
 * Kredi sabitleri — kalibre edilebilir. Açık karar (§7): gerçek üretim maliyetine göre ayarlanır.
 * Mantık: perLocaleCost = base + ekSayfa * perExtraPage; toplam = perLocaleCost * dilSayısı.
 * (Her ek dil ayrı içerik üretimi → maliyet dil sayısıyla çarpan olur.)
 * NOT: credits.ts değişirse scripts/verify-website-credits.mjs JS portu da güncellenmeli.
 */
export const WEBSITE_CREDITS = {
  base: 40, // landing (tek sayfa), tek dil tabanı
  perExtraPage: 15, // ilk sayfadan sonraki her sayfa
} as const

/** Bir revizyon talebinin sabit kredi maliyeti. */
export const WEBSITE_REVISION_COST = 10

export interface GenerationCostInput {
  siteType: SiteType
  pageCount: number
  localeCount: number
}

/** İlk üretim (veya tam yeniden üretim) kredi maliyeti. */
export function computeGenerationCost(input: GenerationCostInput): number {
  const pages = Math.max(1, Math.floor(input.pageCount || 1))
  const locales = Math.max(1, Math.floor(input.localeCount || 1))
  const extraPages = pages - 1
  const perLocaleCost = WEBSITE_CREDITS.base + extraPages * WEBSITE_CREDITS.perExtraPage
  return perLocaleCost * locales
}
