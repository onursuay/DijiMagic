// Deploy-step API routes return short error CODES (or raw provider messages).
// The UI must NEVER render these raw (EN/TR + no-raw-technical-term rules) — map
// them to a translated marketingSetup.errors.* key. Unknown errors fall back to a
// generic translated message (the raw detail stays in server logs / setup_steps).

const CODE_TO_KEY: Record<string, string> = {
  unauthorized: 'errors.notAuthenticated',
  not_authenticated: 'errors.notAuthenticated',
  no_setup: 'errors.noSetup',
  'no setup found': 'errors.noSetup',
  setup_not_found: 'errors.noSetup',
  missing_site_url: 'errors.missingSiteUrl',
  'setup consent required': 'errors.notConnectedSetup',
  not_connected_setup: 'errors.notConnectedSetup',
  meta_not_connected: 'errors.notConnectedMeta',
  no_pixel: 'errors.noPixel',
}

/** Returns a marketingSetup-relative i18n key for a deploy-step error code/message. */
export function stepErrorKey(error?: string | null): string {
  if (!error) return 'errors.deployFailed'
  if (error.startsWith('errors.')) return error
  const direct = CODE_TO_KEY[error] ?? CODE_TO_KEY[error.toLowerCase()]
  if (direct) return direct
  if (/google\s*ads/i.test(error)) return 'errors.notConnectedGoogle'
  return 'errors.deployFailed'
}
