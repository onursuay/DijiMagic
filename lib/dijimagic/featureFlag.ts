/* ──────────────────────────────────────────────────────────
   DijiAlgoritma AI Engine — Feature Flag

   USE_AI_ENGINE=true  → /api/cron/dijialgoritma-scan aktif,
                         AI engine sonuçları üretilir.
   USE_AI_ENGINE=false → eski /api/dijimagic/daily-run flow'u kullanılır
                         (rule engine + adCreator). Rollback yolu.

   Default: false. Production'a açmak için Vercel env'e eklenmeli.
   ────────────────────────────────────────────────────────── */

export function isAiEngineEnabled(): boolean {
  const v = (process.env.USE_AI_ENGINE ?? '').toLowerCase().trim()
  return v === 'true' || v === '1' || v === 'yes'
}

/**
 * DijiAlgoritma per-account scope (Madde 2 — Faz 3.3b). Açıkken command-center
 * yalnız aktif (Meta+Google) seçime ait analizi gösterir; uyuşmazsa o hesap için
 * /api/dijimagic/command-center/refresh ile yeniden üretilir (belgemod fix). Default
 * KAPALI → mevcut per-user (birleşik) davranış, sıfır regresyon.
 */
export function isPerAccountScopeEnabled(): boolean {
  const v = (process.env.DIJIMAGIC_PER_ACCOUNT_SCOPE ?? '').toLowerCase().trim()
  return v === 'true' || v === '1' || v === 'yes'
}

/**
 * Erken Uyarı (günlük nöbetçi) — deterministik, LLM'siz günlük reklam taraması.
 * WATCHDOG_ENABLED=true → /api/cron/erken-uyari günlük (05:00 UTC) çalışır:
 *   bağlı her kullanıcının aktif Meta+Google hesaplarını tarar, acil/bozulma
 *   tespit eder (account_alerts'e yazar) + uyarı e-postası gönderir.
 * Default KAPALI → cron no-op döner (sıfır maliyet, sıfır regresyon).
 * Haftalık AI taramasından (USE_AI_ENGINE) BAĞIMSIZ açılır/kapanır.
 */
export function isWatchdogEnabled(): boolean {
  const v = (process.env.WATCHDOG_ENABLED ?? '').toLowerCase().trim()
  return v === 'true' || v === '1' || v === 'yes'
}
