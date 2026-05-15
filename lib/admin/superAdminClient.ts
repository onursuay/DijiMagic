/**
 * Owner / Süper Admin — client-safe yardımcılar.
 *
 * `lib/admin/superAdmin.ts` server-only olduğu için (cookie + Supabase
 * okur) Client Component'lerden import edilemez. UI tarafında "owner mu?"
 * sorusunu cevaplamak için bu modül kullanılır.
 *
 * Kaynak otorite hâlâ backend'dir. UI bypass (kredi/abonelik modalını
 * atlamak) yalnızca UX katmanıdır — gerçek erişim guardları sunucu
 * tarafında `requireOptimizationAccess` / `isSuperAdminEmail` ile karar
 * verilir. Burada yapılan kontrol salt UI'ın kullanıcıyı yanlışlıkla
 * "engellenmiş" göstermesini önler.
 *
 * Email değerini API tarafı `/api/billing/current` zaten döndürür ve
 * super-admin için enterprise plan + sınırsız özellik bayrakları gönderir.
 * Bu helper localStorage / cookie'den kullanıcı emailini okumayı garanti
 * etmez; provider'lar `isOwner` bayrağını API yanıtından alır.
 */

const DEFAULT_SUPER_ADMIN_EMAIL = 'onursuay@hotmail.com'

/**
 * Public default owner email — UI tarafında allowlist'e ek e-posta
 * eklenmek istenirse bu listeye yazılır. Server tarafı SUPER_ADMIN_EMAILS
 * env'ini kullanmaya devam eder; bu liste sadece UI için fallback'tir.
 */
export const PUBLIC_OWNER_EMAILS: string[] = [DEFAULT_SUPER_ADMIN_EMAIL]

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return PUBLIC_OWNER_EMAILS.includes(normalized)
}
