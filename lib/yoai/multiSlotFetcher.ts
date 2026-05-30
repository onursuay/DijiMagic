import 'server-only'
import { fetchMetaDeep } from './metaDeepFetcher'
import { fetchGoogleDeep } from './googleDeepFetcher'
import { getSelectedAdAccountsForPlatform } from '@/lib/billing/adAccountSlots'
import type { DeepCampaignInsight } from './analysisTypes'

/**
 * Multi-slot deep-fetch wrapper (Faz 3A).
 *
 * Mevcut fetchMetaDeep / fetchGoogleDeep tek hesap için çalışır (override pattern).
 * Bu wrapper kullanıcının TÜM seçili slot'ları üzerinden iterate edip kampanyaları
 * birleştirir. Her kampanyaya hangi slot'tan geldiği iliştirilir (`__slotIndex`,
 * `__slotAccountId`) — downstream analytics ayırt edebilir.
 *
 * Mevcut deep-fetcher'lar HİÇ DEĞİŞTİRİLMEZ; çağıranlar fetchMetaDeep yerine
 * fetchMetaDeepAllSlots'u tercih edebilir (opt-in, sıfır regresyon).
 *
 * `getSelectedAdAccountsForPlatform` boş dönerse (kullanıcının slot tablosu boş)
 * eski tek-hesap akışına geri düşülür — slot sistemi devreye girmeden de çalışır.
 */

export interface SlotTaggedCampaign extends DeepCampaignInsight {
  __slotIndex: number
  __slotAccountId: string
  __slotAccountName: string | null
}

export interface MultiSlotFetchResult {
  campaigns: SlotTaggedCampaign[]
  errors: string[]
  connected: boolean
  /** Veri üreten slot sayısı (kampanya çekebilen). */
  slotsUsed: number
  /** Denenen toplam slot sayısı (= seçili slot sayısı). */
  slotsTried: number
}

// ─── Meta ───────────────────────────────────────────────────────────────────

export async function fetchMetaDeepAllSlots(userId: string): Promise<MultiSlotFetchResult> {
  const slots = await getSelectedAdAccountsForPlatform(userId, 'meta')

  // Slot tablosu boşsa eski tek-hesap akışına düş (geri uyumluluk).
  if (slots.length === 0) {
    const r = await fetchMetaDeep(userId)
    return {
      campaigns: r.campaigns.map((c) => ({
        ...c,
        __slotIndex: 1,
        __slotAccountId: 'legacy',
        __slotAccountName: null,
      })),
      errors: r.errors,
      connected: r.connected,
      slotsUsed: r.connected ? 1 : 0,
      slotsTried: 1,
    }
  }

  const all: SlotTaggedCampaign[] = []
  const errors: string[] = []
  let slotsUsed = 0

  // Sıralı çek — Meta Graph rate-limit'i agresif değil ama paralel yapmıyoruz
  // ki token sıralı yenilensin ve gözlemlemek daha kolay olsun.
  for (const slot of slots) {
    const accountId = slot.account_id.startsWith('act_') ? slot.account_id : `act_${slot.account_id}`
    try {
      const r = await fetchMetaDeep(userId, { adAccountId: accountId })
      if (r.connected) slotsUsed++
      for (const c of r.campaigns) {
        all.push({
          ...c,
          __slotIndex: slot.slot_index,
          __slotAccountId: slot.account_id,
          __slotAccountName: slot.account_name,
        })
      }
      for (const e of r.errors) {
        errors.push(`[slot ${slot.slot_index} / ${slot.account_id}] ${e}`)
      }
    } catch (e) {
      errors.push(
        `[slot ${slot.slot_index} / ${slot.account_id}] fetch_exception: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  return {
    campaigns: all,
    errors,
    connected: slotsUsed > 0,
    slotsUsed,
    slotsTried: slots.length,
  }
}

// ─── Google Ads ─────────────────────────────────────────────────────────────

export async function fetchGoogleDeepAllSlots(userId: string): Promise<MultiSlotFetchResult> {
  const slots = await getSelectedAdAccountsForPlatform(userId, 'google_ads')

  if (slots.length === 0) {
    const r = await fetchGoogleDeep(userId)
    return {
      campaigns: r.campaigns.map((c) => ({
        ...c,
        __slotIndex: 1,
        __slotAccountId: 'legacy',
        __slotAccountName: null,
      })),
      errors: r.errors,
      connected: r.connected,
      slotsUsed: r.connected ? 1 : 0,
      slotsTried: 1,
    }
  }

  const all: SlotTaggedCampaign[] = []
  const errors: string[] = []
  let slotsUsed = 0

  for (const slot of slots) {
    // Google Ads customer id dash'siz string saklanır; loginCustomerId genelde aynıdır.
    const customerId = slot.account_id.replace(/-/g, '')
    try {
      const r = await fetchGoogleDeep(userId, {
        customerId,
        loginCustomerId: customerId,
      })
      if (r.connected) slotsUsed++
      for (const c of r.campaigns) {
        all.push({
          ...c,
          __slotIndex: slot.slot_index,
          __slotAccountId: slot.account_id,
          __slotAccountName: slot.account_name,
        })
      }
      for (const e of r.errors) {
        errors.push(`[slot ${slot.slot_index} / ${slot.account_id}] ${e}`)
      }
    } catch (e) {
      errors.push(
        `[slot ${slot.slot_index} / ${slot.account_id}] fetch_exception: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  return {
    campaigns: all,
    errors,
    connected: slotsUsed > 0,
    slotsUsed,
    slotsTried: slots.length,
  }
}
