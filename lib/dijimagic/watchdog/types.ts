/* ──────────────────────────────────────────────────────────
   Erken Uyarı (Günlük Nöbetçi) — Ortak Tipler

   Deterministik günlük tarama veri sözleşmeleri. Bu modül HİÇBİR
   I/O içermez (tip + saf veri); fetcher'lar bu şekilleri üretir,
   rules.ts bunları okuyup WatchdogFinding üretir.

   "Erken Uyarı" = haftalık AI taramasından (dijialgoritma) AYRI, ucuz
   (LLM'siz) bir acil-durum/bozulma nöbetçisi. Optimizasyon/strateji
   üretmez — yalnız "bir şey ters mi gitti?" sorusuna bakar.
   ────────────────────────────────────────────────────────── */

import type { HierAlertSeverity } from '@/lib/dijimagic/ai/hierarchicalStore'

export type WatchdogSeverity = HierAlertSeverity // 'critical' | 'high' | 'medium' | 'info'
export type WatchdogPlatform = 'meta' | 'google'

/**
 * account_alerts.alert_type değerleri (serbest metin — şema CHECK'i yok).
 * Erken Uyarı'nın ürettiği türler; mevcut AI türleriyle (pixel_missing vb.)
 * çakışmaz, ayrıştırmak için tümü "wd_" öneki taşır.
 */
export type WatchdogFindingType =
  | 'wd_account_suspended'   // hesap politika/risk nedeniyle kapalı/devre dışı
  | 'wd_payment_issue'       // ödeme/bakiye sorunu (unsettled/grace/settlement)
  | 'wd_ad_disapproved'      // aktif kampanyada reddedilmiş reklam
  | 'wd_dead_active_ad'      // aktif ama 0 gösterim & 0 harcama (teknik hata)
  | 'wd_delivery_stopped'    // aktif + bütçe var ama ciddi düşük teslimat
  | 'wd_spend_no_conversion' // anlamlı harcama + 0 dönüşüm (3 gün)
  | 'wd_cpa_spike'           // CPA/CPL baseline'a göre ani sıçrama
  | 'wd_roas_below_1'        // satış kampanyası, ROAS < 1 (zarar)
  | 'wd_high_frequency'      // frekans çok yüksek (kreatif yorgunluğu)
  | 'wd_impression_share_lost' // Google: bütçeden kaybedilen gösterim payı

/** Reklam hesabı durum anlık görüntüsü (hesap seviyesi kontroller için). */
export interface AccountSnapshot {
  platform: WatchdogPlatform
  accountId: string          // Meta: act_X / Google: 10 haneli müşteri ID
  accountName: string
  currency: string
  /** Platform ham durum kodu (Meta account_status / Google customer status). */
  statusCode: string
  /** İnsan-okur durum etiketi (TR). */
  statusLabel: string
  /** Meta disable_reason (varsa) — ödeme mi politika mı ayrımı için. */
  disableReasonCode?: string | null
  disableReasonLabel?: string | null
  /** true = hesap normal çalışıyor; false = askı/ödeme/kapalı. */
  healthy: boolean
}

/** Tek bir kampanya/reklam için nöbetçi metrik anlık görüntüsü. */
export interface WatchdogEntity {
  platform: WatchdogPlatform
  accountId: string
  level: 'campaign' | 'ad'
  id: string
  name: string
  campaignId?: string | null
  adsetId?: string | null
  /** Kullanıcının AYARLADIĞI durum (ACTIVE/PAUSED). */
  configuredStatus: string
  /** Platformun GERÇEK durumu (effective_status / serving status). */
  effectiveStatus: string
  /** Reklam onay durumu (DISAPPROVED vb.) — varsa. */
  reviewStatus?: string | null
  currency: string
  /** Dünkü (son 1 gün) metrikler. */
  spend: number
  impressions: number
  results: number          // objektife göre dönüşüm (lead/satış/mesaj/...)
  resultType: string       // 'lead' | 'purchase' | 'messaging' | 'conversion' | ...
  purchaseValue: number    // satış geliri (action_values) — ROAS için
  frequency: number
  ctr: number
  dailyBudget: number | null
  isSalesObjective: boolean
  /** Son 3 gün toplamı (0-dönüşüm kontrolü yanlış-alarmı azaltır). */
  spend3d: number
  results3d: number
  /** Baseline (≈ son 30 gün, dünü hariç) ortalama CPA — sıçrama kıyası için. */
  cpaBaseline: number | null
  baselineResults: number  // baseline penceresindeki dönüşüm (yeterlilik kontrolü)
}

/** Nöbetçi bulgusu — account_alerts'e yazılacak ham tespit. */
export interface WatchdogFinding {
  type: WatchdogFindingType
  severity: WatchdogSeverity
  platform: WatchdogPlatform
  accountId: string
  accountName: string
  level: 'account' | 'campaign' | 'ad'
  entityId: string | null
  entityName: string | null
  title: string
  body: string
  recommendedAction: string
  /** Tespiti üreten metrik fotoğrafı (alert_payload'a gömülür). */
  evidence: Record<string, unknown>
}

/** Bir kullanıcı taramasının özeti (e-posta + cron yanıtı için). */
export interface UserWatchdogResult {
  userId: string
  accountsScanned: number
  accountsSkipped: number
  findings: WatchdogFinding[]
  alertsWritten: number
  errors: string[]
}
