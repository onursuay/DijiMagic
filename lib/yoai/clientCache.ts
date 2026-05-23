/* ──────────────────────────────────────────────────────────
   YoAlgoritma — client-side cache keys & invalidation
   The /yoai page keeps the last command-center snapshot in the
   browser so a page refresh does not re-show the "scanning" state.
   When the active ad account changes, that snapshot belongs to the
   PREVIOUS account — clear it so a stale snapshot does not flash
   before the fresh fetch.
   ────────────────────────────────────────────────────────── */

/** localStorage — persisted command-center analysis snapshot.
 *  v2: snapshot artık seçili işletme scope imzasıyla birlikte saklanır; başka
 *  işletmenin (örn. eski belgemod) snapshot'ı asla flaş etmesin. v1 (scope'suz,
 *  işletmeler-arası karışan) cache terk edildi. */
export const YOAI_CC_CACHE_KEY = 'yoai_cc_cache_v2'
/** Terk edilen eski (scope'suz) cache anahtarı — temizlikte silinir. */
export const YOAI_CC_CACHE_KEY_LEGACY = 'yoai_cc_cache_v1'
/** sessionStorage — deep-analysis working cache. */
export const YOAI_CC_DEEP_CACHE_KEY = 'yoai_cc_deep_cache'

/**
 * Seçili işletme scope cookie'sinin (yoai_business_scope) anlık değeri.
 * Cache snapshot'ı bu imzayla etiketlenir; imza değişince (başka işletme) eski
 * snapshot gösterilmez. httpOnly:false olduğu için client okuyabilir.
 */
export function readYoaiBusinessScopeCookie(): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(/(?:^|;\s*)yoai_business_scope=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

/**
 * Clear YoAlgoritma's client-side cached analysis.
 * Call on active ad-account switch (Meta/Google). SSR-safe.
 */
export function clearYoAlgoritmaClientCache(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(YOAI_CC_CACHE_KEY) } catch {}
  try { localStorage.removeItem(YOAI_CC_CACHE_KEY_LEGACY) } catch {}
  try { sessionStorage.removeItem(YOAI_CC_DEEP_CACHE_KEY) } catch {}
}
