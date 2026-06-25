/* ──────────────────────────────────────────────────────────
   DijiAlgoritma — Publish Safety Flags (Faz 6)

   Feature flag okuyucuları ve publish guard'ları.
   Tüm env okumaları burada merkezi — route'lar bu helper'ları kullanır.
   LLM çağrısı yapılmaz; sahte veri üretilmez.
   ────────────────────────────────────────────────────────── */

const DEFAULT_MAX_DAILY_BUDGET_TRY = 1000

export interface PublishFlagCheckResult {
  ok: boolean
  code?: 'DIRECT_PUBLISH_DISABLED' | 'ACTIVE_PUBLISH_SAFETY_VIOLATION'
  message?: string
}

/**
 * Doğrudan yayın (one-click-approve) özelliği aktif mi?
 * DIJIMAGIC_DIRECT_PUBLISH_ENABLED=false → devre dışı.
 * Tanımlı değilse ya da 'true' → aktif.
 */
export function isDirectPublishEnabled(): boolean {
  const val = process.env.DIJIMAGIC_DIRECT_PUBLISH_ENABLED
  if (val === undefined || val === null || val === '') return true
  return val.toLowerCase() !== 'false'
}

/**
 * Aktif yayın (ACTIVE status) izni var mı?
 * Sadece DIJIMAGIC_ACTIVE_PUBLISH_ENABLED=true olduğunda true döner.
 * Default: false (güvenli default).
 */
export function isActivePublishEnabled(): boolean {
  return process.env.DIJIMAGIC_ACTIVE_PUBLISH_ENABLED?.toLowerCase() === 'true'
}

/**
 * Aktif yayın izninin kapalı olduğunu doğrular.
 * DIJIMAGIC_ACTIVE_PUBLISH_ENABLED=true ise hata fırlatır — kampanyalar PAUSED kalmalı.
 */
export function assertPausedOnly(): void {
  if (isActivePublishEnabled()) {
    throw new Error(
      '[PublishSafety] DIJIMAGIC_ACTIVE_PUBLISH_ENABLED=true — bu sürümde aktif yayın desteklenmiyor. ' +
      'Tüm kampanyalar PAUSED olarak oluşturulur. Lütfen env değerini false olarak ayarlayın.',
    )
  }
}

/**
 * Günlük bütçe üst sınırını TRY cinsinden okur.
 * Geçersiz/eksikse DEFAULT_MAX_DAILY_BUDGET_TRY döner.
 */
export function getMaxDailyBudgetTry(): number {
  const envCap = process.env.DIJIMAGIC_MAX_DAILY_BUDGET_TRY
  const parsed = envCap ? Number(envCap) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_DAILY_BUDGET_TRY
}

/**
 * Doğrudan yayın feature flag'ini doğrular.
 * DIJIMAGIC_DIRECT_PUBLISH_ENABLED=false ise { ok:false, code:'DIRECT_PUBLISH_DISABLED' } döner.
 */
export function validatePublishFeatureFlags(): PublishFlagCheckResult {
  if (!isDirectPublishEnabled()) {
    return {
      ok: false,
      code: 'DIRECT_PUBLISH_DISABLED',
      message:
        'Doğrudan yayın özelliği şu an devre dışı. ' +
        'Aktifleştirmek için DIJIMAGIC_DIRECT_PUBLISH_ENABLED=true olarak ayarlayın.',
    }
  }
  return { ok: true }
}
