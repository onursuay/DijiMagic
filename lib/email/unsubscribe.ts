import 'server-only'
import { createHmac } from 'node:crypto'

/**
 * Abonelikten-çık (KVKK) token'ı. İmza, (campaignId:email) üzerinden HMAC.
 * Link: {APP_URL}/unsubscribe?c={campaignId}&e={email}&s={sig}
 */
const SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.RESEND_API_KEY || 'yoai-unsub-secret'

export function unsubscribeSig(campaignId: string, email: string): string {
  return createHmac('sha256', SECRET).update(`${campaignId}:${email.trim().toLowerCase()}`).digest('hex').slice(0, 32)
}

export function verifyUnsubscribe(campaignId: string, email: string, sig: string): boolean {
  return unsubscribeSig(campaignId, email) === sig
}

export function unsubscribeUrl(appUrl: string, campaignId: string, email: string): string {
  const e = email.trim().toLowerCase()
  return `${appUrl}/unsubscribe?c=${encodeURIComponent(campaignId)}&e=${encodeURIComponent(e)}&s=${unsubscribeSig(campaignId, e)}`
}
