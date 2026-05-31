import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Abonelikten-çık (KVKK) token'ı. İmza, (campaignId:email) üzerinden HMAC.
 * Link: {APP_URL}/unsubscribe?c={campaignId}&e={email}&s={sig}
 *
 * Gizli anahtar yalnız env'den gelir (UNSUBSCRIBE_SECRET tercih edilir; yoksa
 * RESEND_API_KEY). Hardcoded fallback YOK — anahtar yoksa imza üretilmez ve
 * doğrulama fail-closed (false) döner. Karşılaştırma constant-time.
 */
const SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.RESEND_API_KEY || ''

export function unsubscribeSig(campaignId: string, email: string): string {
  if (!SECRET) return ''
  return createHmac('sha256', SECRET).update(`${campaignId}:${email.trim().toLowerCase()}`).digest('hex').slice(0, 32)
}

export function verifyUnsubscribe(campaignId: string, email: string, sig: string): boolean {
  const expected = unsubscribeSig(campaignId, email)
  if (!expected || !sig) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function unsubscribeUrl(appUrl: string, campaignId: string, email: string): string {
  const e = email.trim().toLowerCase()
  return `${appUrl}/unsubscribe?c=${encodeURIComponent(campaignId)}&e=${encodeURIComponent(e)}&s=${unsubscribeSig(campaignId, e)}`
}
