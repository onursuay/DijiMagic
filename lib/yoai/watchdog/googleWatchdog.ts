/* ──────────────────────────────────────────────────────────
   Erken Uyarı — Google Ads Fetcher + Tarayıcı

   KAPSAM: kullanıcının YoAi Reklam bölümüne EKLEDİĞİ Google hesapları
   (user_registered_ad_accounts, platform=google). Her biri kendi
   login_customer_id'si (MCC) ile çekilir.

   AKTİF ÇALIŞAN: `campaign.primary_status IN ('ELIGIBLE','LIMITED')` —
   gerçekten yayında olanlar. ENDED (tamamlanmış)/PAUSED/REMOVED hariç.
   Ayrıca reddedilen (policy DISAPPROVED) reklamlar yakalanır.

   Salt-OKUMA: yalnız GAQL search. Değişiklik YOK.
   ────────────────────────────────────────────────────────── */

import 'server-only'
import { getGoogleAdsAccessToken, searchGAds, type GoogleAdsRequestContext } from '@/lib/googleAdsAuth'
import { getConnection } from '@/lib/googleAdsConnectionStore'
import { listRegisteredAccounts, ensureBackfilled } from '@/lib/account/registeredAccounts'
import { evaluateAccountFindings } from './rules'
import type { AccountSnapshot, WatchdogEntity, WatchdogFinding } from './types'

const IS_BUDGET_LOST_THRESHOLD = 0.2

function ymd(d: Date): string { return d.toISOString().slice(0, 10) }
function recentRange(days: number): { start: string; end: string } {
  const end = new Date(); end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(); start.setUTCDate(start.getUTCDate() - days)
  return { start: ymd(start), end: ymd(end) }
}

const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  ENABLED: 'Aktif', CANCELED: 'İptal edildi', SUSPENDED: 'Askıya alındı', CLOSED: 'Kapalı', UNKNOWN: 'Bilinmiyor',
}

interface CampaignMetricRow {
  campaign?: { id?: string; name?: string; primaryStatus?: string; advertisingChannelType?: string }
  metrics?: { costMicros?: string; impressions?: string; conversions?: number; conversionsValue?: number; searchBudgetLostImpressionShare?: number }
}

function micros(v?: string): number { return v ? Number(v) / 1e6 : 0 }

function ctxFor(accessToken: string, customerId: string, loginCustomerId: string): GoogleAdsRequestContext {
  return { accessToken, customerId: customerId.replace(/-/g, ''), loginCustomerId: (loginCustomerId || customerId).replace(/-/g, ''), locale: 'tr' }
}

async function scanGoogleAccount(
  accessToken: string, customerId: string, loginCustomerId: string, registeredName: string | null,
): Promise<WatchdogFinding[]> {
  const ctx = ctxFor(accessToken, customerId, loginCustomerId)

  // Hesap durumu + gerçek ad
  let status = 'ENABLED', currency = 'TRY', descriptive = ''
  try {
    const crows = await searchGAds<{ customer?: { descriptiveName?: string; status?: string; currencyCode?: string } }>(
      ctx, `SELECT customer.descriptive_name, customer.status, customer.currency_code FROM customer`,
    )
    const c = crows[0]?.customer
    if (c) { status = c.status || status; currency = c.currencyCode || currency; descriptive = c.descriptiveName || '' }
  } catch { /* erişilemezse devam */ }

  const name = registeredName || descriptive || `Hesap ${customerId}`
  const snapshot: AccountSnapshot = {
    platform: 'google', accountId: customerId, accountName: name, currency,
    statusCode: status, statusLabel: CUSTOMER_STATUS_LABEL[status] ?? status,
    healthy: status === 'ENABLED',
  }
  if (!snapshot.healthy) return evaluateAccountFindings(snapshot, [])

  const r3 = recentRange(3), r30 = recentRange(30)
  const RUNNING = `campaign.primary_status IN ('ELIGIBLE','LIMITED')`

  const [yRows, t3Rows, baseRows] = await Promise.all([
    searchGAds<CampaignMetricRow>(ctx,
      `SELECT campaign.id, campaign.name, campaign.primary_status, campaign.advertising_channel_type,
              metrics.cost_micros, metrics.impressions, metrics.conversions, metrics.conversions_value,
              metrics.search_budget_lost_impression_share
       FROM campaign WHERE ${RUNNING} AND segments.date DURING YESTERDAY`),
    searchGAds<CampaignMetricRow>(ctx,
      `SELECT campaign.id, metrics.cost_micros, metrics.conversions
       FROM campaign WHERE ${RUNNING} AND segments.date BETWEEN '${r3.start}' AND '${r3.end}'`),
    searchGAds<CampaignMetricRow>(ctx,
      `SELECT campaign.id, metrics.cost_micros, metrics.conversions
       FROM campaign WHERE ${RUNNING} AND segments.date BETWEEN '${r30.start}' AND '${r30.end}'`),
  ])

  const sum3d = new Map<string, { cost: number; conv: number }>()
  for (const r of t3Rows) { const id = String(r.campaign?.id); const p = sum3d.get(id) || { cost: 0, conv: 0 }; p.cost += micros(r.metrics?.costMicros); p.conv += Number(r.metrics?.conversions || 0); sum3d.set(id, p) }
  const sumBase = new Map<string, { cost: number; conv: number }>()
  for (const r of baseRows) { const id = String(r.campaign?.id); const p = sumBase.get(id) || { cost: 0, conv: 0 }; p.cost += micros(r.metrics?.costMicros); p.conv += Number(r.metrics?.conversions || 0); sumBase.set(id, p) }

  const entities: WatchdogEntity[] = []
  const directFindings: WatchdogFinding[] = []

  for (const r of yRows) {
    const id = String(r.campaign?.id)
    const cost = micros(r.metrics?.costMicros)
    const convVal = Number(r.metrics?.conversionsValue || 0)
    const t3 = sum3d.get(id) || { cost: 0, conv: 0 }
    const b = sumBase.get(id) || { cost: 0, conv: 0 }
    entities.push({
      platform: 'google', accountId: customerId, level: 'campaign', id, name: r.campaign?.name || id, campaignId: id,
      configuredStatus: 'ACTIVE', effectiveStatus: r.campaign?.primaryStatus || 'ELIGIBLE', currency,
      spend: cost, impressions: Number(r.metrics?.impressions || 0), results: Number(r.metrics?.conversions || 0),
      resultType: 'conversion', purchaseValue: convVal, frequency: 0, ctr: 0, dailyBudget: null,
      isSalesObjective: convVal > 0, spend3d: t3.cost, results3d: t3.conv,
      cpaBaseline: b.conv > 0 ? b.cost / b.conv : null, baselineResults: b.conv,
    })
    const isLost = Number(r.metrics?.searchBudgetLostImpressionShare || 0)
    if (isLost > IS_BUDGET_LOST_THRESHOLD) {
      directFindings.push({
        type: 'wd_impression_share_lost', severity: 'medium', platform: 'google',
        accountId: customerId, accountName: name, level: 'campaign', entityId: id, entityName: r.campaign?.name || id,
        title: `Bütçe yetersiz — gösterim payı kaybı — ${r.campaign?.name || id}`,
        body: `"${r.campaign?.name || id}" kampanyası gösterimlerinin %${Math.round(isLost * 100)}'ini bütçe yetersizliğinden kaybediyor. Talep var ama bütçe yetişmiyor.`,
        recommendedAction: 'Bütçeyi artırmayı veya teklif stratejisini gözden geçirmeyi değerlendirin.',
        evidence: { searchBudgetLostImpressionShare: Number(isLost.toFixed(2)) },
      })
    }
  }

  // Reddedilen reklamlar
  try {
    const adRows = await searchGAds<{ adGroupAd?: { ad?: { id?: string; name?: string } }; campaign?: { id?: string } }>(
      ctx,
      `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, campaign.id
       FROM ad_group_ad
       WHERE ad_group_ad.status = 'ENABLED' AND ad_group_ad.policy_summary.approval_status = 'DISAPPROVED'`,
      { maxRows: 50 },
    )
    for (const r of adRows) {
      const adId = String(r.adGroupAd?.ad?.id || '')
      entities.push({
        platform: 'google', accountId: customerId, level: 'ad', id: adId,
        name: r.adGroupAd?.ad?.name || `Reklam ${adId}`, campaignId: r.campaign?.id ?? null,
        configuredStatus: 'ACTIVE', effectiveStatus: 'DISAPPROVED', reviewStatus: 'DISAPPROVED',
        currency, spend: 0, impressions: 0, results: 0, resultType: 'conversion', purchaseValue: 0,
        frequency: 0, ctr: 0, dailyBudget: null, isSalesObjective: false,
        spend3d: 0, results3d: 0, cpaBaseline: null, baselineResults: 0,
      })
    }
  } catch { /* erişilemezse atla */ }

  return [...evaluateAccountFindings(snapshot, entities), ...directFindings]
}

/** Kullanıcının KAYITLI Google hesaplarını tara. */
export async function runGoogleWatchdog(userId: string): Promise<{ findings: WatchdogFinding[]; scanned: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  const conn = await getConnection(userId)
  if (!conn?.refreshToken) return { findings: [], scanned: 0, skipped: 0, errors: ['google_not_connected'] }

  let accessToken: string
  try { accessToken = await getGoogleAdsAccessToken(conn.refreshToken) }
  catch (e) { return { findings: [], scanned: 0, skipped: 0, errors: [`google_token:${e instanceof Error ? e.message : 'error'}`] } }

  // Kapsam = kayıtlı Google hesapları. Boşsa backfill + bağlı hesap fallback.
  let registered = (await listRegisteredAccounts(userId)).filter((a) => a.platform === 'google')
  if (registered.length === 0) {
    try { await ensureBackfilled(userId) } catch { /* geç */ }
    registered = (await listRegisteredAccounts(userId)).filter((a) => a.platform === 'google')
  }
  let targets = registered.map((a) => ({ customerId: a.account_id, loginCustomerId: a.login_customer_id || conn.loginCustomerId || a.account_id, name: a.account_name }))
  if (targets.length === 0 && conn.customerId) {
    targets = [{ customerId: conn.customerId, loginCustomerId: conn.loginCustomerId || conn.customerId, name: null }]
  }
  if (targets.length === 0) return { findings: [], scanned: 0, skipped: 0, errors: ['google_no_registered_accounts'] }

  const findings: WatchdogFinding[] = []
  let scanned = 0
  for (const tgt of targets) {
    try {
      findings.push(...await scanGoogleAccount(accessToken, tgt.customerId, tgt.loginCustomerId, tgt.name))
      scanned++
    } catch (e) {
      errors.push(`google:${tgt.customerId}:${e instanceof Error ? e.message : 'error'}`)
    }
  }
  return { findings, scanned, skipped: 0, errors }
}
