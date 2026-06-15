/* ──────────────────────────────────────────────────────────
   Erken Uyarı — Meta Fetcher + Tarayıcı

   Bağlı token'ın eriştiği TÜM Meta reklam hesaplarını otomatik keşfeder
   (/me/adaccounts), "aktiviteli" olanları (son 30g harcama > 0) tarar,
   geri kalanı (yedek/test/uzun-ölü) atlar. Her hesap için durum + aktif
   kampanya/reklam metriklerini çeker → rules.ts'e verir.

   Salt-OKUMA: yalnız GET. Hiçbir reklamı/hesabı DEĞİŞTİRMEZ.
   ────────────────────────────────────────────────────────── */

import 'server-only'
import { metaGraphFetchJSON } from '@/lib/metaGraph'
import { getMetaConnection } from '@/lib/metaConnectionStore'
import { countMetaConversions } from '@/lib/yoai/metaConversions'
import { evaluateAccountFindings } from './rules'
import type { AccountSnapshot, WatchdogEntity, WatchdogFinding } from './types'

const MAX_ACCOUNTS = 40       // token başına taranacak hesap tavanı (gürültü/load guard)
const MAX_CAMPAIGNS = 50
const MAX_ADS = 100

// ── Meta account_status / disable_reason etiketleri ──
const ACCOUNT_STATUS: Record<string, string> = {
  '1': 'Aktif', '2': 'Devre dışı', '3': 'Ödenmemiş bakiye', '7': 'Risk incelemesi',
  '8': 'Ödeme bekliyor', '9': 'Ödeme ek süresi', '100': 'Kapatılma sürecinde', '101': 'Kapalı',
}
const DISABLE_REASON: Record<string, string> = {
  '0': '', '1': 'Reklam politikası ihlali', '2': 'Fikri mülkiyet incelemesi', '3': 'Ödeme riski',
  '4': 'Hesap kapatıldı', '5': 'İnceleme', '6': 'İşletme bütünlüğü', '7': 'Kalıcı kapatma',
  '8': 'Kullanılmayan bayi hesabı', '9': 'Kullanılmayan hesap',
}

const PURCHASE_VALUE_TYPES = new Set([
  'purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase',
])

function actionValue(rows: Array<{ action_type: string; value: string }> | undefined, types: Set<string>): number {
  let tot = 0
  for (const r of rows ?? []) if (types.has(r.action_type)) tot += Number(r.value || 0)
  return tot
}

/** Graph `actions` dizisini countMetaConversions'ın beklediği Record'a çevirir. */
function actionsToRecord(rows?: Array<{ action_type: string; value: string }>): Record<string, number> {
  const rec: Record<string, number> = {}
  for (const r of rows ?? []) rec[r.action_type] = Number(r.value || 0)
  return rec
}

function objectiveMeta(objective: string): { isSales: boolean; resultType: string } {
  const o = (objective || '').toUpperCase()
  if (o.includes('SALES') || o.includes('CONVERSIONS')) return { isSales: true, resultType: 'purchase' }
  if (o.includes('LEAD')) return { isSales: false, resultType: 'lead' }
  if (o.includes('ENGAGEMENT') || o.includes('MESSAGES') || o.includes('TRAFFIC')) return { isSales: false, resultType: 'messaging' }
  return { isSales: false, resultType: 'conversion' }
}

interface InsightRow {
  campaign_id?: string
  ad_id?: string
  spend?: string
  impressions?: string
  clicks?: string
  ctr?: string
  frequency?: string
  actions?: Array<{ action_type: string; value: string }>
  action_values?: Array<{ action_type: string; value: string }>
}

/** Bir time window için level=campaign|ad insight haritası (id → row). */
async function fetchInsightsMap(
  token: string, accountId: string, level: 'campaign' | 'ad', datePreset: string,
): Promise<Map<string, InsightRow>> {
  const { data, error } = await metaGraphFetchJSON<{ data: InsightRow[] }>(
    `/${accountId}/insights`, token,
    { params: {
      level,
      date_preset: datePreset,
      fields: 'campaign_id,ad_id,spend,impressions,clicks,ctr,frequency,actions,action_values',
      limit: '500',
    } },
  )
  const map = new Map<string, InsightRow>()
  if (error || !data?.data) return map
  for (const row of data.data) {
    const key = level === 'campaign' ? row.campaign_id : row.ad_id
    if (key) map.set(key, row)
  }
  return map
}

/** Token'ın eriştiği tüm reklam hesaplarını keşfet. */
export async function discoverMetaAccounts(token: string): Promise<Array<{ id: string; name: string; statusCode: string; disableReason: string; currency: string }>> {
  const { data, error } = await metaGraphFetchJSON<{ data: Array<{ id: string; name: string; account_status: number; disable_reason?: number; currency: string }> }>(
    `/me/adaccounts`, token,
    { params: { fields: 'id,name,account_status,disable_reason,currency', limit: '200' } },
  )
  if (error || !data?.data) return []
  return data.data.map((a) => ({
    id: a.id.startsWith('act_') ? a.id : `act_${a.id}`,
    name: a.name || a.id,
    statusCode: String(a.account_status ?? ''),
    disableReason: String(a.disable_reason ?? '0'),
    currency: a.currency || 'TRY',
  }))
}

/** Hesabın son 30 gün toplam harcaması (aktivite filtresi için). */
async function account30dSpend(token: string, accountId: string): Promise<number> {
  const { data, error } = await metaGraphFetchJSON<{ data: Array<{ spend?: string }> }>(
    `/${accountId}/insights`, token,
    { params: { date_preset: 'last_30d', fields: 'spend', level: 'account' } },
  )
  if (error || !data?.data?.[0]) return 0
  return Number(data.data[0].spend || 0)
}

/** Bir Meta hesabını tara → bulgular. */
async function scanMetaAccount(
  token: string,
  meta: { id: string; name: string; statusCode: string; disableReason: string; currency: string },
): Promise<WatchdogFinding[]> {
  const snapshot: AccountSnapshot = {
    platform: 'meta', accountId: meta.id, accountName: meta.name, currency: meta.currency,
    statusCode: meta.statusCode, statusLabel: ACCOUNT_STATUS[meta.statusCode] ?? `Durum ${meta.statusCode}`,
    disableReasonCode: meta.disableReason !== '0' ? meta.disableReason : null,
    disableReasonLabel: meta.disableReason !== '0' ? (DISABLE_REASON[meta.disableReason] || null) : null,
    healthy: meta.statusCode === '1',
  }

  // Hesap sağlıksızsa: entity çekme, yalnız hesap-seviyesi uyarı üret.
  if (!snapshot.healthy) return evaluateAccountFindings(snapshot, [])

  // Kampanyalar (yalnız configured ACTIVE)
  const campRes = await metaGraphFetchJSON<{ data: Array<{ id: string; name: string; status: string; effective_status: string; objective: string; daily_budget?: string }> }>(
    `/${meta.id}/campaigns`, token,
    { params: { fields: 'id,name,status,effective_status,objective,daily_budget', limit: String(MAX_CAMPAIGNS), effective_status: '["ACTIVE","PAUSED","CAMPAIGN_PAUSED","WITH_ISSUES","PENDING_REVIEW","DISAPPROVED"]' } },
  )
  const campaigns = (campRes.data?.data ?? []).filter((c) => (c.status || '').toUpperCase() === 'ACTIVE')

  // Insight pencereleri (yesterday / 3d / 30d-baseline) — kampanya + reklam seviyeleri
  const [campY, camp3d, campBase, adList, ad3d] = await Promise.all([
    fetchInsightsMap(token, meta.id, 'campaign', 'yesterday'),
    fetchInsightsMap(token, meta.id, 'campaign', 'last_3d'),
    fetchInsightsMap(token, meta.id, 'campaign', 'last_30d'),
    metaGraphFetchJSON<{ data: Array<{ id: string; name: string; status: string; effective_status: string; campaign_id?: string; adset_id?: string; ad_review_feedback?: unknown }> }>(
      `/${meta.id}/ads`, token,
      { params: { fields: 'id,name,status,effective_status,campaign_id,adset_id,ad_review_feedback', limit: String(MAX_ADS), effective_status: '["ACTIVE","PAUSED","WITH_ISSUES","PENDING_REVIEW","DISAPPROVED","ADSET_PAUSED","CAMPAIGN_PAUSED"]' } },
    ),
    fetchInsightsMap(token, meta.id, 'ad', 'last_3d'),
  ])

  const entities: WatchdogEntity[] = []

  // ── Kampanya seviyesi (metrik kontrolleri: 0-dönüşüm, CPA, ROAS, frekans, teslimat) ──
  for (const c of campaigns) {
    const { isSales, resultType } = objectiveMeta(c.objective)
    const y = campY.get(c.id)
    const t3 = camp3d.get(c.id)
    const b = campBase.get(c.id)
    const spend = Number(y?.spend || 0)
    const impressions = Number(y?.impressions || 0)
    const results = countMetaConversions(actionsToRecord(y?.actions))
    const spend3d = Number(t3?.spend || 0)
    const results3d = countMetaConversions(actionsToRecord(t3?.actions))
    const baseSpend = Number(b?.spend || 0)
    const baseResults = countMetaConversions(actionsToRecord(b?.actions))
    const cpaBaseline = baseResults > 0 ? baseSpend / baseResults : null
    entities.push({
      platform: 'meta', accountId: meta.id, level: 'campaign', id: c.id, name: c.name,
      campaignId: c.id, configuredStatus: c.status, effectiveStatus: c.effective_status,
      currency: meta.currency, spend, impressions, results, resultType,
      purchaseValue: actionValue(y?.action_values, PURCHASE_VALUE_TYPES),
      frequency: Number(y?.frequency || 0), ctr: Number(y?.ctr || 0),
      dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null, // Meta minor units
      isSalesObjective: isSales, spend3d, results3d, cpaBaseline, baselineResults: baseResults,
    })
  }

  // ── Reklam seviyesi (yalnız reddedilen + ölü-aktif tespiti) ──
  const activeCampaignIds = new Set(campaigns.map((c) => c.id))
  const ads = (adList.data?.data ?? []).filter((a) => (a.status || '').toUpperCase() === 'ACTIVE')
  for (const a of ads) {
    // Yalnız aktif kampanyaların altındaki aktif reklamlar (pasif kampanya altı gürültü değil)
    if (a.campaign_id && activeCampaignIds.size > 0 && !activeCampaignIds.has(a.campaign_id)) continue
    const ins = ad3d.get(a.id)
    const eff = (a.effective_status || '').toUpperCase()
    const isDisapproved = eff === 'DISAPPROVED' || eff === 'WITH_ISSUES' || Boolean(a.ad_review_feedback && Object.keys(a.ad_review_feedback as object).length > 0)
    const impressions3d = Number(ins?.impressions || 0)
    const spendAd3d = Number(ins?.spend || 0)
    // Yalnız iki durumda entity üret: reddedilen VEYA ölü (0 gösterim+0 harcama). Diğerleri kampanya seviyesinde.
    if (!isDisapproved && (impressions3d > 0 || spendAd3d > 0)) continue
    entities.push({
      platform: 'meta', accountId: meta.id, level: 'ad', id: a.id, name: a.name,
      campaignId: a.campaign_id ?? null, adsetId: a.adset_id ?? null,
      configuredStatus: a.status, effectiveStatus: a.effective_status,
      reviewStatus: isDisapproved ? 'DISAPPROVED' : null,
      currency: meta.currency, spend: 0, impressions: 0, results: 0, resultType: 'conversion',
      purchaseValue: 0, frequency: 0, ctr: 0, dailyBudget: null, isSalesObjective: false,
      spend3d: spendAd3d, results3d: 0, cpaBaseline: null, baselineResults: 0,
    })
  }

  return evaluateAccountFindings(snapshot, entities)
}

/** Kullanıcı için tüm Meta hesaplarını tara. */
export async function runMetaWatchdog(userId: string): Promise<{ findings: WatchdogFinding[]; scanned: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  const conn = await getMetaConnection(userId)
  if (!conn?.accessToken) return { findings: [], scanned: 0, skipped: 0, errors: ['meta_not_connected'] }
  const token = conn.accessToken

  let accounts = await discoverMetaAccounts(token)
  if (accounts.length === 0) return { findings: [], scanned: 0, skipped: 0, errors: ['meta_no_accounts'] }
  accounts = accounts.slice(0, MAX_ACCOUNTS)

  const findings: WatchdogFinding[] = []
  let scanned = 0, skipped = 0

  // Aktivite filtresi + tarama (hesaplar arası sınırlı paralellik)
  for (const acc of accounts) {
    try {
      const spend30 = await account30dSpend(token, acc.id)
      // Aktivite yok → yedek/test/uzun-ölü hesap; atla (gürültü yok). Sağlıksızsa bile
      // 30g harcaması yoksa "yönetimde aktif" sayılmaz.
      if (spend30 <= 0) { skipped++; continue }
      const accFindings = await scanMetaAccount(token, acc)
      findings.push(...accFindings)
      scanned++
    } catch (e) {
      errors.push(`meta:${acc.id}:${e instanceof Error ? e.message : 'error'}`)
    }
  }

  return { findings, scanned, skipped, errors }
}
