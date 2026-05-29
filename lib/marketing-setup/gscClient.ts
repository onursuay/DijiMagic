import 'server-only'

import { fetchWithRetry } from '@/lib/integrations/googleOAuthHelpers'
import { GSC_API_BASE, SITE_VERIFICATION_API_BASE } from './constants'

/**
 * Search Console (Webmasters v3) + Site Verification API deploy step.
 *
 * Adds the property to Search Console and attempts ownership verification using
 * the same Google Analytics / Google Tag Manager tag the wizard installs on the
 * site (no extra DNS or HTML file work for the user).
 *
 * Verification can only succeed if the GA4 / GTM tag is already live on the page
 * — Google fetches the URL and looks for the snippet. When the tag is not yet
 * reachable server-side, we return `verified:false` with the method attempted
 * rather than fabricating a verified state.
 *
 * Real Google APIs only — uses fetchWithRetry for 429 / 5xx backoff.
 */

type VerificationMethod = 'ANALYTICS' | 'TAG' | 'NONE'

interface SiteVerificationToken {
  token?: string
  method?: string
}

async function googleJson(
  res: Response,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

function googleErr(data: Record<string, unknown>, fallback: string): string {
  const err = data?.error as { message?: string } | undefined
  return err?.message || fallback
}

/**
 * Add the site to Search Console (idempotent — a 409/already-exists is fine).
 */
async function addSite(accessToken: string, siteUrl: string): Promise<void> {
  const encoded = encodeURIComponent(siteUrl)
  const res = await fetchWithRetry(`${GSC_API_BASE}/sites/${encoded}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  // PUT /sites is idempotent: 200/204 add, 409 means it is already present.
  if (!res.ok && res.status !== 409) {
    const { data } = await googleJson(res)
    throw new Error(googleErr(data, `Search Console add-site error ${res.status}`))
  }
}

/**
 * Request a verification token for a method. Returns null when Google rejects
 * the method (e.g. no Analytics/GTM tag association) so we can try the next one.
 */
async function getVerificationToken(
  accessToken: string,
  siteUrl: string,
  method: 'ANALYTICS' | 'TAG',
): Promise<string | null> {
  const res = await fetchWithRetry(`${SITE_VERIFICATION_API_BASE}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      verificationMethod: method,
      site: { type: 'SITE', identifier: siteUrl },
    }),
  })
  if (!res.ok) return null
  const { data } = await googleJson(res)
  const token = (data as SiteVerificationToken).token
  return typeof token === 'string' && token.length > 0 ? token : null
}

/**
 * Insert (claim) ownership for a method. Google fetches the live page and looks
 * for the GA/GTM tag — succeeds only when the tag is already deployed.
 */
async function insertVerification(
  accessToken: string,
  siteUrl: string,
  method: 'ANALYTICS' | 'TAG',
): Promise<boolean> {
  const res = await fetchWithRetry(
    `${SITE_VERIFICATION_API_BASE}/webResource?verificationMethod=${method}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        site: { type: 'SITE', identifier: siteUrl },
      }),
    },
  )
  return res.ok
}

export async function deploySearchConsole(
  accessToken: string,
  opts: { siteUrl: string },
): Promise<{ siteUrl: string; verified: boolean; verificationMethod: string }> {
  const siteUrl = opts.siteUrl
  if (!siteUrl) {
    throw new Error('siteUrl is required')
  }

  // 1) Register the property in Search Console.
  await addSite(accessToken, siteUrl)

  // 2) Attempt verification with the GA tag method first, then the GTM tag.
  const order: Array<'ANALYTICS' | 'TAG'> = ['ANALYTICS', 'TAG']
  let attempted: VerificationMethod = 'NONE'

  for (const method of order) {
    const token = await getVerificationToken(accessToken, siteUrl, method)
    if (!token) continue // Google won't issue this method — try the next.
    attempted = method
    const ok = await insertVerification(accessToken, siteUrl, method)
    if (ok) {
      return { siteUrl, verified: true, verificationMethod: method }
    }
  }

  // Verification could not complete server-side (tag not yet live on the page).
  // Return the truthful state — never fake verified:true.
  return { siteUrl, verified: false, verificationMethod: attempted }
}
