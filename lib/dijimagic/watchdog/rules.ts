/* ──────────────────────────────────────────────────────────
   Erken Uyarı — Deterministik Kural Motoru (SAF, I/O YOK)

   Girdi: AccountSnapshot + WatchdogEntity[]  →  Çıktı: WatchdogFinding[]
   LLM yok, ağ yok → ucuz + birim test edilebilir (scripts/verify-erken-uyari.mjs).

   Felsefe: yalnız ACİL DURUM + BOZULMA. Optimizasyon önerisi ÜRETMEZ.
   Eşikler mevcut optimizasyon motoruyla (lib/meta/optimization/ruleEngine.ts)
   tutarlı tutulur; para-birimi zayıfsa (TRY) eşik yükselir.
   ────────────────────────────────────────────────────────── */

import type {
  AccountSnapshot,
  WatchdogEntity,
  WatchdogFinding,
  WatchdogFindingType,
  WatchdogSeverity,
} from './types'

// ── Para birimi çarpanı (ruleEngine.ts ile aynı taban: TRY=1.0) ──
const CURRENCY_MULTIPLIER: Record<string, number> = {
  TRY: 1.0, USD: 0.05, EUR: 0.05, GBP: 0.04, BRL: 0.2, INR: 3.0, IDR: 50.0, JPY: 5.0,
}
function currencyFactor(currency?: string): number {
  if (!currency) return 1.0
  return CURRENCY_MULTIPLIER[currency.toUpperCase()] ?? 1.0
}

// ── Eşikler (TRY tabanı; factor ile ölçeklenir) ──
export const WATCHDOG_THRESHOLDS = {
  /** "Anlamlı harcama" tabanı (3 gün) — altındaysa 0-dönüşüm yanlış-alarm sayılır. */
  spendFloor3d: 150,
  /** CPA sıçrama çarpanları (baseline'a göre). */
  cpaSpikeWarn: 1.5,
  cpaSpikeHigh: 2.0,
  /** Baseline/aktif dönem yeterli veri eşiği (dönüşüm adedi). */
  minBaselineResults: 5,
  minRecentResults: 2,
  /** Frekans (kreatif yorgunluğu). */
  freqWarn: 4.0,
  freqHigh: 6.0,
  /** Teslimat: aktif + bütçe var ama harcama bütçenin bu oranının altında. */
  underDeliveryRatio: 0.5,
  /** Düşük teslimat tespiti için minimum gün-içi bütçe (gürültü filtresi). */
  minBudgetForDelivery: 50,
} as const

function fmt(n: number, currency: string): string {
  return `${Math.round(n).toLocaleString('tr-TR')} ${currency}`
}

// ════════════════════════════════════════════════════════════
// Hesap seviyesi kontroller (askı / ödeme)
// ════════════════════════════════════════════════════════════
export function evaluateAccount(acc: AccountSnapshot): WatchdogFinding[] {
  if (acc.healthy) return []

  const reason = (acc.disableReasonCode ?? '').toString()
  // Meta disable_reason: 3 = risk_payment. Google: BILLING/SUSPENDED durumları.
  const isPayment =
    reason === '3' ||
    /unsettled|grace|settlement|billing|payment|ödeme/i.test(acc.statusLabel + ' ' + (acc.disableReasonLabel ?? ''))

  const type: WatchdogFindingType = isPayment ? 'wd_payment_issue' : 'wd_account_suspended'
  const title = isPayment
    ? `Ödeme/bakiye sorunu — ${acc.accountName}`
    : `Hesap durduruldu/askıya alındı — ${acc.accountName}`
  const body = isPayment
    ? `${acc.accountName} hesabının ödeme durumu sorunlu (${acc.statusLabel}${acc.disableReasonLabel ? `, ${acc.disableReasonLabel}` : ''}). Bu durumda reklamlar yayından kalkar ve harcama durur.`
    : `${acc.accountName} hesabı şu an aktif değil (${acc.statusLabel}${acc.disableReasonLabel ? `, ${acc.disableReasonLabel}` : ''}). Reklamlar yayında olmayabilir.`
  const action = isPayment
    ? 'Reklam hesabı ödeme ayarlarını kontrol edin; kart/limit/bakiye sorununu giderin.'
    : 'Hesap durumunu reklam yöneticisinden inceleyin; politika ihlali varsa itiraz edin.'

  return [{
    type, severity: 'critical', platform: acc.platform,
    accountId: acc.accountId, accountName: acc.accountName,
    level: 'account', entityId: acc.accountId, entityName: acc.accountName,
    title, body, recommendedAction: action,
    evidence: { statusCode: acc.statusCode, statusLabel: acc.statusLabel, disableReasonCode: acc.disableReasonCode, disableReasonLabel: acc.disableReasonLabel },
  }]
}

// ════════════════════════════════════════════════════════════
// Reklam/kampanya seviyesi kontroller
// ════════════════════════════════════════════════════════════
export function evaluateEntity(e: WatchdogEntity): WatchdogFinding[] {
  const out: WatchdogFinding[] = []
  const factor = currencyFactor(e.currency)
  const base = (severity: WatchdogSeverity, type: WatchdogFindingType, title: string, body: string, action: string, evidence: Record<string, unknown>): WatchdogFinding => ({
    type, severity, platform: e.platform, accountId: e.accountId, accountName: '',
    level: e.level, entityId: e.id, entityName: e.name, title, body, recommendedAction: action, evidence,
  })

  const configuredActive = (e.configuredStatus || '').toUpperCase() === 'ACTIVE'
  if (!configuredActive) return out // yalnız kullanıcının AKTİF ettikleri

  const eff = (e.effectiveStatus || '').toUpperCase()
  const review = (e.reviewStatus || '').toUpperCase()

  // 1) REDDEDİLEN reklam (aktif etmişsin ama platform reddetmiş)
  if (review === 'DISAPPROVED' || eff === 'DISAPPROVED' || eff === 'WITH_ISSUES') {
    out.push(base('high', 'wd_ad_disapproved',
      `Reddedilen reklam — ${e.name}`,
      `"${e.name}" aktif olarak ayarlanmış ama platform tarafından reddedilmiş/sorunlu (${e.effectiveStatus}). Yayınlanmıyor ya da harcama boşa gidiyor olabilir.`,
      'Reklamı politika geri bildirimine göre düzeltin veya itiraz edin.',
      { effectiveStatus: e.effectiveStatus, reviewStatus: e.reviewStatus }))
    return out // reddedilmişse diğer metrik kontrolleri anlamsız
  }

  // 2) AKTİF AMA ÇALIŞMIYOR (0 gösterim & 0 harcama) = teknik hata
  if (e.impressions <= 0 && e.spend <= 0 && e.spend3d <= 0) {
    out.push(base('high', 'wd_dead_active_ad',
      `Aktif ama çalışmıyor — ${e.name}`,
      `"${e.name}" aktif görünüyor ama son günlerde hiç gösterim almıyor ve harcama yapmıyor. Genelde teknik bir hata vardır (boş hedefleme, kreatif reddi, bütçe 0, çok düşük teklif veya öğrenme takılması).`,
      'Hedefleme, teklif, bütçe ve kreatif onayını kontrol edin; reklam neden teslim edilmiyor inceleyin.',
      { spend: e.spend, impressions: e.impressions, spend3d: e.spend3d }))
    return out // ölüyse metrik kontrolü anlamsız
  }

  // 3) TESLİMAT DURDU/DÜŞÜK (kampanya: aktif + bütçe var ama harcama çok düşük)
  if (e.level === 'campaign' && e.dailyBudget && e.dailyBudget >= WATCHDOG_THRESHOLDS.minBudgetForDelivery * factor && e.impressions > 0) {
    if (e.spend < e.dailyBudget * WATCHDOG_THRESHOLDS.underDeliveryRatio) {
      out.push(base('medium', 'wd_delivery_stopped',
        `Düşük teslimat — ${e.name}`,
        `"${e.name}" kampanyası aktif ve günlük bütçesi ${fmt(e.dailyBudget, e.currency)} ama dün yalnız ${fmt(e.spend, e.currency)} harcadı (bütçenin %50'sinden az). Teslimat kısıtlı olabilir.`,
        'Hedef kitle darlığı, teklif veya öğrenme fazı kısıtlarını kontrol edin.',
        { spend: e.spend, dailyBudget: e.dailyBudget }))
    }
  }

  // 4) HARCAMA VAR + 0 DÖNÜŞÜM (3 gün, anlamlı harcama tabanı)
  if (e.spend3d >= WATCHDOG_THRESHOLDS.spendFloor3d * factor && e.results3d <= 0) {
    out.push(base('high', 'wd_spend_no_conversion',
      `Harcama var, dönüşüm yok — ${e.name}`,
      `"${e.name}" son 3 günde ${fmt(e.spend3d, e.currency)} harcadı ama hiç ${trResult(e.resultType)} getirmedi. Doğrudan para sızıntısı.`,
      'Dönüşüm takibini (pixel/dönüşüm), hedeflemeyi ve teklif/optimizasyon hedefini kontrol edin.',
      { spend3d: e.spend3d, results3d: e.results3d, resultType: e.resultType }))
  }

  // 5) CPA/CPL SIÇRAMASI (baseline'a göre) — yeterli veri varsa
  if (
    e.cpaBaseline && e.cpaBaseline > 0 &&
    e.baselineResults >= WATCHDOG_THRESHOLDS.minBaselineResults &&
    e.results3d >= WATCHDOG_THRESHOLDS.minRecentResults &&
    e.spend3d > 0
  ) {
    const recentCpa = e.spend3d / e.results3d
    const ratio = recentCpa / e.cpaBaseline
    if (ratio >= WATCHDOG_THRESHOLDS.cpaSpikeWarn) {
      const severity: WatchdogSeverity = ratio >= WATCHDOG_THRESHOLDS.cpaSpikeHigh ? 'high' : 'medium'
      out.push(base(severity, 'wd_cpa_spike',
        `Maliyet sıçraması — ${e.name}`,
        `"${e.name}" için ${trResult(e.resultType)} başına maliyet son 3 günde ${fmt(recentCpa, e.currency)}'e çıktı (önceki ortalama ${fmt(e.cpaBaseline, e.currency)}, ${Math.round((ratio - 1) * 100)}% artış).`,
        'Rekabet, kitle yorgunluğu veya teklif değişimini inceleyin; gerekiyorsa kreatif/teklif güncelleyin.',
        { recentCpa: Math.round(recentCpa), baselineCpa: Math.round(e.cpaBaseline), ratio: Number(ratio.toFixed(2)) }))
    }
  }

  // 6) ROAS < 1 (satış kampanyası — zararına satış)
  if (e.isSalesObjective && e.spend > 0) {
    const roas = e.purchaseValue > 0 ? e.purchaseValue / e.spend : 0
    if (roas > 0 && roas < 1) {
      out.push(base('high', 'wd_roas_below_1',
        `Zararına satış (ROAS < 1) — ${e.name}`,
        `"${e.name}" dün ${fmt(e.spend, e.currency)} harcadı, ${fmt(e.purchaseValue, e.currency)} ciro getirdi (ROAS ${roas.toFixed(2)}). Harcama ciroyu aşıyor.`,
        'Hedefleme/teklif/kreatif verimliliğini gözden geçirin; zarar büyümeden müdahale edin.',
        { spend: e.spend, purchaseValue: e.purchaseValue, roas: Number(roas.toFixed(2)) }))
    }
  }

  // 7) FREKANS YÜKSEK (kreatif yorgunluğu)
  if (e.frequency >= WATCHDOG_THRESHOLDS.freqWarn) {
    const severity: WatchdogSeverity = e.frequency >= WATCHDOG_THRESHOLDS.freqHigh ? 'high' : 'medium'
    out.push(base(severity, 'wd_high_frequency',
      `Yüksek frekans — ${e.name}`,
      `"${e.name}" için frekans ${e.frequency.toFixed(1)}. Aynı kişilere çok sık gösteriliyor; kreatif yorgunluğu ve CTR düşüşü riski var.`,
      'Kreatifi yenileyin veya kitleyi genişletin.',
      { frequency: Number(e.frequency.toFixed(1)) }))
  }

  return out
}

function trResult(resultType: string): string {
  switch ((resultType || '').toLowerCase()) {
    case 'lead': return 'lead'
    case 'purchase': return 'satış'
    case 'messaging': return 'mesajlaşma'
    default: return 'dönüşüm'
  }
}

/** Bir hesabın tüm bulgularını üretir (hesap + tüm entity'ler). */
export function evaluateAccountFindings(acc: AccountSnapshot, entities: WatchdogEntity[]): WatchdogFinding[] {
  const accountFindings = evaluateAccount(acc)
  // Hesap askı/ödeme varsa entity kontrolleri gürültüdür (her şey duracaktır) → atla.
  if (accountFindings.length > 0) return accountFindings.map((f) => ({ ...f, accountName: acc.accountName }))
  const entityFindings = entities.flatMap(evaluateEntity)
  return entityFindings.map((f) => ({ ...f, accountName: acc.accountName }))
}
