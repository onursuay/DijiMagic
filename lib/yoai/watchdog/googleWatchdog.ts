/* ──────────────────────────────────────────────────────────
   Erken Uyarı — Google Ads Fetcher + Tarayıcı

   Bağlı refresh token + MCC (login-customer-id) altındaki TÜM müşteri
   hesaplarını keşfeder (customer_client), aktiviteli olanları tarar.
   Hesap durumu + aktif kampanya metrikleri + reddedilen reklam +
   gösterim payı kaybı → rules.ts (+ Google'a özel IS kaybı).

   Salt-OKUMA: yalnız GAQL search (GET semantiği). Değişiklik YOK.
   ────────────────────────────────────────────────────────── */

import 'server-only'
import { getGoogleAdsAccessToken, searchGAds, type GoogleAdsRequestContext } from '@/lib/googleAdsAuth'
import { getConnection } from '@/lib/googleAdsConnectionStore'
import { evaluateAccountFindings } from './rules'
import type { AccountSnapshot, WatchdogEntity, WatchdogFinding } from './types'

const MAX_ACCOUNTS = 60
const IS_BUDGET_LOST_THRESHOLD = 0.2 // bütçeden kaybedilen gösterim payı > %20

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}
/** Son N günün [başlangıç, dün] tarih aralığı (bugünü hariç tutar). */
function recentRange(days: number): { start: string; end: string } {
  const end = new Date(); end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(); start.setUTCDate(start.getUTCDate() - days)
  return { start: ymd(start), end: ymd(end) }
}

const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  ENABLED: 'Aktif', CANCELED: 'İptal edildi', SUSPENDED: 'Askıya alındı', CLOSED: 'Kapalı', UNKNOWN: 'Bilinmiyor',
}

interface CampaignMetricRow {
  campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string }
  metrics?: { costMicros?: string; impressions?: string; conversions?: number; conversionsValue?: number; searchBudgetLostImpressionShare?: number }
  campaignBudget?: { amountMicros?: string }
}

function micros(v?: string): number { return v ? Number(v) / 1e6 : 0 }

/** ctx üret (belirli müşteri için; token paylaşılır, yalnız customerId değişir). */
function ctxFor(accessToken: string, customerId: string, loginCustomerId: string): GoogleAdsRequestContext {
  return { accessToken, customerId: customerId.replace(/-/g, ''), loginCustomerId: loginCustomerId.replace(/-/g, ''), locale: 'tr' }
}

/** MCC altındaki tüm müşteri hesaplarını keşfet (manager değil, harcayan hesaplar). */
export async function discoverGoogleAccounts(
  accessToken: string, managerId: string,
): Promise<Array<{ id: string; name: string; currency: string; status: string }>> {
  const mctx = ctxFor(accessToken, managerId, managerId)
  try {
    const rows = await searchGAds<{ customerClient?: { id?: string; descriptiveName?: string; currencyCode?: string; status?: string; manager?: boolean; level?: string } }>(
      mctx,
      `SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code,
              customer_client.status, customer_client.manager, customer_client.level
       FROM customer_client
       WHERE customer_client.status = 'ENABLED'`,
    )
    const accts = rows
      .map((r) => r.customerClient)
      .filter((c): c is NonNullable<typeof c> => Boolean(c?.id) && !c?.manager)
      .map((c) => ({ id: String(c.id), name: c.descriptiveName || String(c.id), currency: c.currencyCode || 'TRY', status: c.status || 'ENABLED' }))
    // Tekilleştir
    const seen = new Set<string>()
    return accts.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
  } catch {
    // Manager değilse / customer_client erişilemezse: yalnız bağlı hesabın kendisi
    return [{ id: managerId.replace(/-/g, ''), name: managerId, currency: 'TRY', status: 'ENABLED' }]
  }
}

async function scanGoogleAccount(
  accessToken: string, managerId: string,
  acc: { id: string; name: string; currency: string; status: string },
): Promise<WatchdogFinding[]> {
  const ctx = ctxFor(accessToken, acc.id, managerId)

  // Hesap durumu + para birimi (descriptive)
  let status = acc.status, currency = acc.currency, name = acc.name
  try {
    const crows = await searchGAds<{ customer?: { descriptiveName?: string; status?: string; currencyCode?: string } }>(
      ctx, `SELECT customer.descriptive_name, customer.status, customer.currency_code FROM customer`,
    )
    const c = crows[0]?.customer
    if (c) { status = c.status || status; currency = c.currencyCode || currency; name = c.descriptiveName || name }
  } catch { /* erişilemezse keşif değerleriyle devam */ }

  const snapshot: AccountSnapshot = {
    platform: 'google', accountId: acc.id, accountName: name, currency,
    statusCode: status, statusLabel: CUSTOMER_STATUS_LABEL[status] ?? status,
    healthy: status === 'ENABLED',
  }
  if (!snapshot.healthy) return evaluateAccountFindings(snapshot, [])

  const r3 = recentRange(3)
  const r30 = recentRange(30)

  // Kampanya metrikleri: dün / son 3g / baseline 30g
  const [yRows, t3Rows, baseRows] = await Promise.all([
    searchGAds<CampaignMetricRow>(ctx,
      `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
              metrics.cost_micros, metrics.impressions, metrics.conversions, metrics.conversions_value,
              metrics.search_budget_lost_impression_share
       FROM campaign WHERE campaign.status = 'ENABLED' AND segments.date DURING YESTERDAY`),
    searchGAds<CampaignMetricRow>(ctx,
      `SELECT campaign.id, metrics.cost_micros, metrics.conversions
       FROM campaign WHERE campaign.status = 'ENABLED' AND segments.date BETWEEN '${r3.start}' AND '${r3.end}'`),
    searchGAds<CampaignMetricRow>(ctx,
      `SELECT campaign.id, metrics.cost_micros, metrics.conversions
       FROM campaign WHERE campaign.status = 'ENABLED' AND segments.date BETWEEN '${r30.start}' AND '${r30.end}'`),
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
    const conv = Number(r.metrics?.conversions || 0)
    const convVal = Number(r.metrics?.conversionsValue || 0)
    const t3 = sum3d.get(id) || { cost: 0, conv: 0 }
    const b = sumBase.get(id) || { cost: 0, conv: 0 }
    entities.push({
      platform: 'google', accountId: acc.id, level: 'campaign', id, name: r.campaign?.name || id, campaignId: id,
      configuredStatus: 'ACTIVE', effectiveStatus: r.campaign?.status || 'ENABLED', currency,
      spend: cost, impressions: Number(r.metrics?.impressions || 0), results: conv, resultType: 'conversion',
      purchaseValue: convVal, frequency: 0, ctr: 0, dailyBudget: null,
      isSalesObjective: convVal > 0, spend3d: t3.cost, results3d: t3.conv,
      cpaBaseline: b.conv > 0 ? b.cost / b.conv : null, baselineResults: b.conv,
    })
    // Google'a özel: bütçeden kaybedilen gösterim payı
    const isLost = Number(r.metrics?.searchBudgetLostImpressionShare || 0)
    if (isLost > IS_BUDGET_LOST_THRESHOLD) {
      directFindings.push({
        type: 'wd_impression_share_lost', severity: 'medium', platform: 'google',
        accountId: acc.id, accountName: name, level: 'campaign', entityId: id, entityName: r.campaign?.name || id,
        title: `Bütçe yetersiz — gösterim payı kaybı — ${r.campaign?.name || id}`,
        body: `"${r.campaign?.name || id}" kampanyası gösterimlerinin %${Math.round(isLost * 100)}'ini bütçe yetersizliğinden kaybediyor. Talep var ama bütçe yetişmiyor.`,
        recommendedAction: 'Bütçeyi artırmayı veya teklif stratejisini gözden geçirmeyi değerlendirin.',
        evidence: { searchBudgetLostImpressionShare: Number(isLost.toFixed(2)) },
      })
    }
  }

  // Reddedilen reklamlar (aktif reklam grubu reklamları)
  try {
    const adRows = await searchGAds<{ adGroupAd?: { ad?: { id?: string; name?: string }; status?: string; policySummary?: { approvalStatus?: string } }; campaign?: { id?: string; name?: string } }>(
      ctx,
      `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status,
              ad_group_ad.policy_summary.approval_status, campaign.name
       FROM ad_group_ad
       WHERE ad_group_ad.status = 'ENABLED' AND ad_group_ad.policy_summary.approval_status = 'DISAPPROVED'`,
      { maxRows: 50 },
    )
    for (const r of adRows) {
      const adId = String(r.adGroupAd?.ad?.id || '')
      entities.push({
        platform: 'google', accountId: acc.id, level: 'ad', id: adId,
        name: r.adGroupAd?.ad?.name || `Reklam ${adId}`, campaignId: r.campaign?.id ?? null,
        configuredStatus: 'ACTIVE', effectiveStatus: 'DISAPPROVED', reviewStatus: 'DISAPPROVED',
        currency, spend: 0, impressions: 0, results: 0, resultType: 'conversion', purchaseValue: 0,
        frequency: 0, ctr: 0, dailyBudget: null, isSalesObjective: false,
        spend3d: 0, results3d: 0, cpaBaseline: null, baselineResults: 0,
      })
    }
  } catch { /* reklam onay sorgusu erişilemezse atla */ }

  return [...evaluateAccountFindings(snapshot, entities), ...directFindings]
}

/** Kullanıcı için tüm Google Ads hesaplarını tara. */
export async function runGoogleWatchdog(userId: string): Promise<{ findings: WatchdogFinding[]; scanned: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  const conn = await getConnection(userId)
  if (!conn?.refreshToken || !conn?.customerId) return { findings: [], scanned: 0, skipped: 0, errors: ['google_not_connected'] }

  let accessToken: string
  try {
    accessToken = await getGoogleAdsAccessToken(conn.refreshToken)
  } catch (e) {
    return { findings: [], scanned: 0, skipped: 0, errors: [`google_token:${e instanceof Error ? e.message : 'error'}`] }
  }
  const managerId = conn.loginCustomerId || conn.customerId

  let accounts = await discoverGoogleAccounts(accessToken, managerId)
  accounts = accounts.slice(0, MAX_ACCOUNTS)

  const findings: WatchdogFinding[] = []
  let scanned = 0, skipped = 0
  for (const acc of accounts) {
    try {
      // Aktivite filtresi: son 30g harcaması olmayan hesabı atla
      const ctx = ctxFor(accessToken, acc.id, managerId)
      const r30 = recentRange(30)
      const spendRows = await searchGAds<{ metrics?: { costMicros?: string } }>(
        ctx, `SELECT metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${r30.start}' AND '${r30.end}'`,
      )
      const spend30 = spendRows.reduce((s, r) => s + micros(r.metrics?.costMicros), 0)
      if (spend30 <= 0) { skipped++; continue }
      findings.push(...await scanGoogleAccount(accessToken, managerId, acc))
      scanned++
    } catch (e) {
      errors.push(`google:${acc.id}:${e instanceof Error ? e.message : 'error'}`)
    }
  }
  return { findings, scanned, skipped, errors }
}
