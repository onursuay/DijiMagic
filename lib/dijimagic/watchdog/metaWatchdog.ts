/* ──────────────────────────────────────────────────────────
   Erken Uyarı — Meta Fetcher + Tarayıcı

   KAPSAM: kullanıcının DijiMagic Reklam bölümüne EKLEDİĞİ hesaplar
   (user_registered_ad_accounts). Token'ın gördüğü her hesap DEĞİL.

   AKTİF ÇALIŞAN: yalnız `effective_status === 'ACTIVE'` (Meta'nın gerçekten
   yayında saydığı). Toggle açık ama "Tamamlandı"/duraklatılmış/arşiv olanlar
   effective ACTIVE DEĞİLDİR → veriye girmez (metaDeepFetcher ile aynı tanım).
   Ayrı sorguyla DISAPPROVED/WITH_ISSUES reklamlar (reddedilen) yakalanır.

   Salt-OKUMA: yalnız GET. Hiçbir reklamı/hesabı DEĞİŞTİRMEZ.
   ────────────────────────────────────────────────────────── */

import 'server-only'
import { metaGraphFetchJSON } from '@/lib/metaGraph'
import { getMetaConnection } from '@/lib/metaConnectionStore'
import { listRegisteredAccounts, ensureBackfilled } from '@/lib/account/registeredAccounts'
import { countMetaConversions } from '@/lib/dijimagic/metaConversions'
import { evaluateAccountFindings } from './rules'
import type { AccountSnapshot, WatchdogEntity, WatchdogFinding } from './types'

const MAX_CAMPAIGNS = 60
const MAX_ADS = 150

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

/** act_ önekini garanti et. */
function actId(id: string): string {
  return id.startsWith('act_') ? id : `act_${id}`
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

async function fetchInsightsMap(
  token: string, accountId: string, level: 'campaign' | 'ad', datePreset: string,
): Promise<Map<string, InsightRow>> {
  const { data, error } = await metaGraphFetchJSON<{ data: InsightRow[] }>(
    `/${accountId}/insights`, token,
    { params: {
      level, date_preset: datePreset,
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

/** Bir Meta hesabını tara → bulgular. registeredName: dropdown'daki gerçek ad. */
async function scanMetaAccount(token: string, accountId: string, registeredName: string | null): Promise<WatchdogFinding[]> {
  const id = actId(accountId)

  // Hesap durumu + gerçek ad
  const accRes = await metaGraphFetchJSON<{ name?: string; account_status?: number; disable_reason?: number; currency?: string }>(
    `/${id}`, token, { params: { fields: 'name,account_status,disable_reason,currency' } },
  )
  const statusCode = String(accRes.data?.account_status ?? '')
  const disableReason = String(accRes.data?.disable_reason ?? '0')
  const currency = accRes.data?.currency || 'TRY'
  const name = registeredName || accRes.data?.name || `Hesap ${accountId}`

  const snapshot: AccountSnapshot = {
    platform: 'meta', accountId: id, accountName: name, currency,
    statusCode, statusLabel: ACCOUNT_STATUS[statusCode] ?? `Durum ${statusCode}`,
    disableReasonCode: disableReason !== '0' ? disableReason : null,
    disableReasonLabel: disableReason !== '0' ? (DISABLE_REASON[disableReason] || null) : null,
    healthy: statusCode === '1',
  }
  if (!snapshot.healthy) return evaluateAccountFindings(snapshot, [])

  // YALNIZ effective_status ACTIVE kampanyalar (gerçekten yayında — tamamlanmış/duraklatılmış hariç)
  const campRes = await metaGraphFetchJSON<{ data: Array<{ id: string; name: string; effective_status: string; objective: string; daily_budget?: string }> }>(
    `/${id}/campaigns`, token,
    { params: { fields: 'id,name,effective_status,objective,daily_budget', limit: String(MAX_CAMPAIGNS), effective_status: '["ACTIVE"]' } },
  )
  const campaigns = campRes.data?.data ?? []

  const [campY, camp3d, campBase, activeAds, disapprovedAds, ad3d] = await Promise.all([
    fetchInsightsMap(token, id, 'campaign', 'yesterday'),
    fetchInsightsMap(token, id, 'campaign', 'last_3d'),
    fetchInsightsMap(token, id, 'campaign', 'last_30d'),
    metaGraphFetchJSON<{ data: Array<{ id: string; name: string; campaign_id?: string; effective_status: string }> }>(
      `/${id}/ads`, token, { params: { fields: 'id,name,campaign_id,effective_status', limit: String(MAX_ADS), effective_status: '["ACTIVE"]' } }),
    metaGraphFetchJSON<{ data: Array<{ id: string; name: string; campaign_id?: string; effective_status: string }> }>(
      `/${id}/ads`, token, { params: { fields: 'id,name,campaign_id,effective_status', limit: '50', effective_status: '["DISAPPROVED","WITH_ISSUES"]' } }),
    fetchInsightsMap(token, id, 'ad', 'last_3d'),
  ])

  const entities: WatchdogEntity[] = []
  const runningCampaignIds = new Set(campaigns.map((c) => c.id))

  // Kampanya seviyesi metrik kontrolleri
  for (const c of campaigns) {
    const { isSales, resultType } = objectiveMeta(c.objective)
    const y = campY.get(c.id), t3 = camp3d.get(c.id), b = campBase.get(c.id)
    const baseSpend = Number(b?.spend || 0)
    const baseResults = countMetaConversions(actionsToRecord(b?.actions))
    entities.push({
      platform: 'meta', accountId: id, level: 'campaign', id: c.id, name: c.name, campaignId: c.id,
      configuredStatus: 'ACTIVE', effectiveStatus: c.effective_status, currency,
      spend: Number(y?.spend || 0), impressions: Number(y?.impressions || 0),
      results: countMetaConversions(actionsToRecord(y?.actions)), resultType,
      purchaseValue: actionValue(y?.action_values, PURCHASE_VALUE_TYPES),
      frequency: Number(y?.frequency || 0), ctr: Number(y?.ctr || 0),
      dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
      isSalesObjective: isSales,
      spend3d: Number(t3?.spend || 0), results3d: countMetaConversions(actionsToRecord(t3?.actions)),
      cpaBaseline: baseResults > 0 ? baseSpend / baseResults : null, baselineResults: baseResults,
    })
  }

  // Reddedilen reklamlar (ayrı sorgu — effective DISAPPROVED/WITH_ISSUES)
  for (const a of (disapprovedAds.data?.data ?? [])) {
    entities.push({
      platform: 'meta', accountId: id, level: 'ad', id: a.id, name: a.name, campaignId: a.campaign_id ?? null,
      configuredStatus: 'ACTIVE', effectiveStatus: a.effective_status, reviewStatus: 'DISAPPROVED',
      currency, spend: 0, impressions: 0, results: 0, resultType: 'conversion', purchaseValue: 0,
      frequency: 0, ctr: 0, dailyBudget: null, isSalesObjective: false,
      spend3d: 0, results3d: 0, cpaBaseline: null, baselineResults: 0,
    })
  }

  // Aktif ama çalışmayan reklamlar (effective ACTIVE ama 0 gösterim+harcama = teknik hata)
  for (const a of (activeAds.data?.data ?? [])) {
    if (a.campaign_id && runningCampaignIds.size > 0 && !runningCampaignIds.has(a.campaign_id)) continue
    const ins = ad3d.get(a.id)
    const impressions3d = Number(ins?.impressions || 0)
    const spend3d = Number(ins?.spend || 0)
    if (impressions3d > 0 || spend3d > 0) continue // teslim ediyor → sorun yok
    entities.push({
      platform: 'meta', accountId: id, level: 'ad', id: a.id, name: a.name, campaignId: a.campaign_id ?? null,
      configuredStatus: 'ACTIVE', effectiveStatus: a.effective_status, currency,
      spend: 0, impressions: 0, results: 0, resultType: 'conversion', purchaseValue: 0,
      frequency: 0, ctr: 0, dailyBudget: null, isSalesObjective: false,
      spend3d: 0, results3d: 0, cpaBaseline: null, baselineResults: 0,
    })
  }

  return evaluateAccountFindings(snapshot, entities)
}

/** Kullanıcının KAYITLI (Reklam bölümüne eklediği) Meta hesaplarını tara. */
export async function runMetaWatchdog(userId: string): Promise<{ findings: WatchdogFinding[]; scanned: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  const conn = await getMetaConnection(userId)
  if (!conn?.accessToken) return { findings: [], scanned: 0, skipped: 0, errors: ['meta_not_connected'] }
  const token = conn.accessToken

  // Kapsam = kayıtlı hesaplar (dropdown'daki). Boşsa backfill + seçili hesap fallback.
  let registered = (await listRegisteredAccounts(userId)).filter((a) => a.platform === 'meta')
  if (registered.length === 0) {
    try { await ensureBackfilled(userId) } catch { /* geç */ }
    registered = (await listRegisteredAccounts(userId)).filter((a) => a.platform === 'meta')
  }
  let targets = registered.map((a) => ({ accountId: a.account_id, name: a.account_name }))
  if (targets.length === 0 && conn.selectedAdAccountId) {
    targets = [{ accountId: conn.selectedAdAccountId, name: null }]
  }
  if (targets.length === 0) return { findings: [], scanned: 0, skipped: 0, errors: ['meta_no_registered_accounts'] }

  const findings: WatchdogFinding[] = []
  let scanned = 0
  for (const tgt of targets) {
    try {
      findings.push(...await scanMetaAccount(token, tgt.accountId, tgt.name))
      scanned++
    } catch (e) {
      errors.push(`meta:${tgt.accountId}:${e instanceof Error ? e.message : 'error'}`)
    }
  }
  return { findings, scanned, skipped: 0, errors }
}
