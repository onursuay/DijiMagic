/**
 * lib/website/sandboxHmac.mjs
 *
 * Saf HMAC imzalama / doğrulama yardımcısı — sandbox → Vercel callback'leri için.
 *
 * İmza şeması:
 *   Header adı  : x-sandbox-signature-256
 *   Format       : sha256=<hex-digest>
 *   İmzalanan   : rawBody (UTF-8 string — ham POST gövdesi)
 *   Algoritma   : HMAC-SHA256 (node:crypto timingSafeEqual ile)
 *
 * .mjs olduğu için `node scripts/verify-sandbox-hmac.mjs` ile transpilasyon
 * gerekmeksizin doğrudan test edilebilir.
 *
 * Meta webhook verifyWebhookSignature deseniyle birebir aynı yaklaşım.
 */

import crypto from 'node:crypto'

/**
 * Verilen rawBody + secret ikilisinden imza üretir.
 * @param {string} rawBody
 * @param {string} secret
 * @returns {string}  "sha256=<hex>"
 */
export function signSandboxBody(rawBody, secret) {
  const hex = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  return 'sha256=' + hex
}

/**
 * Sandbox'tan gelen imzayı doğrular.
 * @param {string} rawBody          — ham POST gövdesi (text)
 * @param {string | null} signatureHeader — "x-sandbox-signature-256" header değeri
 * @param {string} secret           — WEBSITE_SANDBOX_HMAC_SECRET
 * @returns {boolean}
 */
export function verifySandboxSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
