import 'server-only'
import { getGoogleSetupToken } from './setupStore'
import { refreshAccessToken } from '@/lib/integrations/googleOAuthHelpers'

/**
 * Resolve a fresh Google access token for the Marketing Setup write flows
 * (GTM / GA4 Admin / Search Console / Site Verification).
 *
 * Reads the stored refresh token (saved during the dedicated "setup" Google
 * consent — see app/api/oauth/setup-google/*), then exchanges it for a
 * short-lived access token. This token is NEVER persisted; it is fetched
 * on-demand per request.
 *
 * Returns null when no refresh token is stored for the user (consent not
 * granted yet) or when the refresh exchange fails — callers must treat null as
 * "not connected" and surface a real error, never fabricate success.
 */
export async function getSetupAccessToken(userId: string): Promise<string | null> {
  const stored = await getGoogleSetupToken(userId)
  if (!stored?.refreshToken) return null
  try {
    return await refreshAccessToken(stored.refreshToken)
  } catch (err) {
    console.error('MARKETING_SETUP_ACCESS_TOKEN_FAIL', err instanceof Error ? err.message : String(err))
    return null
  }
}

/**
 * Report whether the dedicated "setup" Google consent has been granted and
 * which scopes were approved. Powers GET /api/oauth/setup-google/status and
 * the connect-step UI.
 */
export async function getSetupConsentStatus(
  userId: string,
): Promise<{ connected: boolean; scopes: string[] }> {
  const stored = await getGoogleSetupToken(userId)
  if (!stored?.refreshToken) return { connected: false, scopes: [] }
  return { connected: true, scopes: stored.scopes }
}
