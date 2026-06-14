import 'server-only'

/**
 * Faz 3 — custom domain → subdomain eşlemesini Vercel Edge Config'e yazar.
 * Middleware bu eşlemeyi edge'de okuyup host'u doğru siteye yönlendirir.
 * Anahtarlar `cd_` ön ekli (nokta → alt çizgi); Edge Config key kuralı [A-Za-z0-9_-].
 */

/** host → Edge Config anahtarı (middleware AYNI dönüşümü uygular). */
export function customDomainKey(host: string): string {
  return 'cd_' + host.toLowerCase().replace(/[^a-z0-9]/g, '_')
}

function edgeConfigId(): string | null {
  const m = (process.env.EDGE_CONFIG || '').match(/(ecfg_[a-zA-Z0-9]+)/)
  return m ? m[1] : null
}

export function isEdgeConfigWriteReady(): boolean {
  return Boolean(edgeConfigId() && process.env.VERCEL_API_TOKEN)
}

async function patchItems(
  items: { operation: 'upsert' | 'delete'; key: string; value?: string }[],
): Promise<boolean> {
  const id = edgeConfigId()
  const token = process.env.VERCEL_API_TOKEN
  if (!id || !token) return false
  const team = process.env.VERCEL_TEAM_ID ?? ''
  const res = await fetch(`https://api.vercel.com/v1/edge-config/${id}/items?teamId=${team}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(10_000),
  })
  return res.status >= 200 && res.status < 300
}

export async function setCustomDomainMapping(host: string, subdomain: string): Promise<boolean> {
  return patchItems([{ operation: 'upsert', key: customDomainKey(host), value: subdomain }])
}

export async function removeCustomDomainMapping(host: string): Promise<boolean> {
  return patchItems([{ operation: 'delete', key: customDomainKey(host) }])
}
