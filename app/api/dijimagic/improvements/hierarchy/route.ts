import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { getImprovementHierarchy, type AccountAlertRow, type HierStatus, type ImprovementHierarchy } from '@/lib/dijimagic/ai/hierarchicalStore'
import { isPerAccountScopeEnabled } from '@/lib/dijimagic/featureFlag'
import { resolveDijiMagicScope } from '@/lib/dijimagic/businessScope'
import { buildAccountScope, getBestAvailableRun } from '@/lib/dijimagic/dailyRunStore'
import { normalizeMetaAccountId, normalizeGoogleCustomerId } from '@/lib/dijimagic/businessKey'
import { listRegisteredAccounts } from '@/lib/account/registeredAccounts'
import { getMetaConnection } from '@/lib/metaConnectionStore'
import { getConnection as getGoogleConnection } from '@/lib/googleAdsConnectionStore'

/**
 * Kullanıcının O AN kayıtlı/aktif reklam hesaplarını çözer (KOŞULSUZ filtre için).
 * Kaynak: user_registered_ad_accounts (çoklu hesap kümesi) + canlı aktif bağlantı
 * (henüz backfill olmamış tek-hesap kullanıcıları). Dönen küme normalize'tir.
 */
async function resolveActiveAdAccounts(userId: string): Promise<{
  metaIds: Set<string>
  googleIds: Set<string>
  hasMeta: boolean
  hasGoogle: boolean
}> {
  const metaIds = new Set<string>()
  const googleIds = new Set<string>()

  const registered = await listRegisteredAccounts(userId).catch(() => [])
  for (const a of registered) {
    if (a.platform === 'meta') {
      const n = normalizeMetaAccountId(a.account_id)
      if (n) metaIds.add(n)
    } else if (a.platform === 'google') {
      const n = normalizeGoogleCustomerId(a.account_id)
      if (n) googleIds.add(n)
    }
  }

  // Canlı seçili bağlantı (kayıtlı küme boşsa/backfill olmadıysa gerçeği yansıt).
  try {
    const meta = await getMetaConnection(userId)
    const n = normalizeMetaAccountId(meta?.selectedAdAccountId)
    if (n) metaIds.add(n)
  } catch { /* meta bağlantısı yok/expired — geç */ }
  try {
    const g = await getGoogleConnection(userId)
    const n = normalizeGoogleCustomerId(g?.customerId)
    if (n) googleIds.add(n)
  } catch { /* google bağlantısı yok — geç */ }

  return { metaIds, googleIds, hasMeta: metaIds.size > 0, hasGoogle: googleIds.size > 0 }
}

/**
 * KOŞULSUZ hesap-uyarısı filtresi (flag'e bağlı DEĞİL): yalnız kullanıcının O AN
 * kayıtlı/aktif hesaplarına ait uyarıları tut → pasif/silinmiş hesapların
 * "Hesap Sağlık Durumu" uyarıları asla görünmez.
 *   • account_id dolu → o platformun aktif hesap kümesinde olmalı.
 *   • account_id NULL (legacy) → yalnız o platformun AKTİF hesabı/seçimi varsa tut.
 */
function filterAlertsToActiveAccounts(
  alerts: AccountAlertRow[],
  active: { metaIds: Set<string>; googleIds: Set<string>; hasMeta: boolean; hasGoogle: boolean },
): AccountAlertRow[] {
  return alerts.filter((a) => {
    if (a.account_id != null) {
      if (a.source_platform === 'meta') {
        const n = normalizeMetaAccountId(a.account_id)
        return n != null && active.metaIds.has(n)
      }
      if (a.source_platform === 'google') {
        const n = normalizeGoogleCustomerId(a.account_id)
        return n != null && active.googleIds.has(n)
      }
      return false
    }
    // Legacy (account_id NULL): platform aktifse tut; platformsuz uyarı (her ikisi
    // de yoksa) yalnız hiç aktif hesap kalmamışsa elenir.
    if (a.source_platform === 'meta') return active.hasMeta
    if (a.source_platform === 'google') return active.hasGoogle
    return active.hasMeta || active.hasGoogle
  })
}

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/**
 * GET /api/dijimagic/improvements/hierarchy
 * Hiyerarşik geliştirme kartlarını döner:
 *   { accountAlerts[], campaigns[ { ...campaign, adsets[ { ...adset, ads[] } ] } ] }
 * Query: ?status=pending,approved,applied,rejected_by_user (varsayılan görünür statüler)
 *
 * İşletme scope'u (DIJIMAGIC_PER_ACCOUNT_SCOPE): kartlar `user_id`'ye göre saklanır ve
 * hesap boyutu taşımaz; bu yüzden seçili işletmenin scope'lu günlük analizindeki
 * kampanya kimliklerine göre filtrelenir (başka hesabın — örn. belgemod — kartları
 * görünmez). Eşleşen scope'lu analiz henüz hazır değilse `scopePending` döner.
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status')
    const statuses = statusParam
      ? (statusParam.split(',').map((s) => s.trim()).filter(Boolean) as HierStatus[])
      : undefined

    const data = await getImprovementHierarchy(userId, statuses)

    // ── KOŞULSUZ hesap-uyarısı filtresi (flag'den BAĞIMSIZ) ──
    // "Hesap Sağlık Durumu" yalnız kullanıcının O AN kayıtlı/aktif hesaplarını
    // göstermeli. getImprovementHierarchy hesap filtresi UYGULAMAZ (yalnız status) →
    // pasif/silinmiş hesapların uyarıları sızardı. Burada her zaman süzülür; scope ON
    // dalı bunu ayrıca seçili işletmeye daraltır (çift filtre = doğru sonuç).
    const activeAccounts = await resolveActiveAdAccounts(userId)
    data.accountAlerts = filterAlertsToActiveAccounts(data.accountAlerts, activeAccounts)

    // ── Outcome rozetleri: applied/öneri sonucunu kartlara iliştir (öğrenen beyin ölçümü) ──
    // dijimagic_recommendation_results.proposal_id === ad_improvement.id eşleşmesiyle.
    try {
      const { listRecommendationResults } = await import('@/lib/dijimagic/resultTrackingStore')
      const results = await listRecommendationResults(userId, { limit: 200 })
      if (results.length) {
        // results created_at DESC → ilk görülen EN YENİ; duplike varsa en yeni outcome kazanır.
        const byProposal = new Map<string, typeof results[number]>()
        for (const r of results) if (!byProposal.has(r.proposal_id)) byProposal.set(r.proposal_id, r)
        for (const c of data.campaigns) {
          for (const as of c.adsets) {
            for (const ad of as.ads) {
              const r = byProposal.get(ad.id)
              if (r) ad.outcome = { outcome: r.outcome, summary: r.outcome_summary, status: r.status, delta: r.metric_delta }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[improvements hierarchy GET] outcome iliştirme atlandı:', e instanceof Error ? e.message : e)
    }

    // ── İşletme scope'u: kartları seçili işletmeye sınırla ──
    if (isPerAccountScopeEnabled()) {
      const scope = await resolveDijiMagicScope()
      if (scope.scoped) {
        const hasMeta = !!scope.metaId
        const hasGoogle = !!scope.googleCustomerId
        const metaAcc = normalizeMetaAccountId(scope.metaId)
        const googleAcc = normalizeGoogleCustomerId(scope.googleCustomerId)

        // Hesap uyarıları account_id taşır → günlük analizden BAĞIMSIZ, doğrudan o
        // hesaba göre süz (eşleşen analiz olmasa bile doğru hesabın kartları görünür).
        // Hesap boyutlu (account_id dolu) → O hesaba göre; legacy (account_id NULL) →
        // yalnız o platformun AKTİF seçimi varsa (başka hesabın/silinmiş bağlantının
        // uyarısı sızmasın).
        const scopedAlerts = data.accountAlerts.filter((a) => {
          if (a.account_id != null) {
            if (a.source_platform === 'meta') return metaAcc != null && normalizeMetaAccountId(a.account_id) === metaAcc
            if (a.source_platform === 'google') return googleAcc != null && normalizeGoogleCustomerId(a.account_id) === googleAcc
            return false
          }
          return (a.source_platform === 'meta' && hasMeta) || (a.source_platform === 'google' && hasGoogle) || a.source_platform == null
        })

        // Kampanya kartları account_id taşımaz → seçili işletmenin scope'lu günlük
        // analizindeki kampanya kimliklerine göre süz. Eşleşen analiz henüz hazır
        // değilse kampanyalar "hazırlanıyor" (scopePending); hesap uyarıları yine gösterilir.
        const run = await getBestAvailableRun(userId)
        const currentSig = buildAccountScope(scope.metaId, scope.googleCustomerId)
        const runCampaigns: any[] | null =
          run && run.account_scope === currentSig && run.command_center_data?.campaigns
            ? (run.command_center_data.campaigns as any[])
            : null

        if (!runCampaigns) {
          return NextResponse.json(
            { ok: true, data: { accountAlerts: scopedAlerts, campaigns: [] } as ImprovementHierarchy, scopePending: true },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        }

        const allowed = new Set<string>(
          runCampaigns
            .filter((c) => c && c.id != null && c.platform)
            .map((c) => `${String(c.platform).toLowerCase()}:${String(c.id)}`),
        )
        const filtered: ImprovementHierarchy = {
          accountAlerts: scopedAlerts,
          campaigns: data.campaigns.filter((c) =>
            allowed.has(`${String(c.source_platform)}:${String(c.campaign_id)}`),
          ),
        }
        return NextResponse.json({ ok: true, data: filtered }, { headers: { 'Cache-Control': 'no-store' } })
      }
    }

    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[improvements hierarchy GET] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
