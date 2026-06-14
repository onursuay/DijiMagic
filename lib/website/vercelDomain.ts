import 'server-only'

/**
 * Faz 3 — Vercel Domains API ile kullanıcı domainini projeye bağlama/çıkarma + DNS bilgisi.
 * Token eksikse graceful (configured:false). Token + projectId .env.local / .vercel/project.json'dan.
 */

const API = 'https://api.vercel.com'

export function isVercelDomainReady(): boolean {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_TEAM_ID)
}

export interface DomainDnsRecord { type: string; name: string; value: string }
export interface DomainAttachResult {
  ok: boolean
  verified: boolean
  records: DomainDnsRecord[]
  error?: string
}

async function vfetch(path: string, init: RequestInit, teamId?: string): Promise<{ status: number; body: unknown }> {
  const token = process.env.VERCEL_API_TOKEN
  const url = `${API}${path}${path.includes('?') ? '&' : '?'}teamId=${teamId ?? process.env.VERCEL_TEAM_ID ?? ''}`
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(12_000),
  })
  let body: unknown = null
  try { body = await res.json() } catch { /* boş */ }
  return { status: res.status, body }
}

/** Apex mi (firma.com) yoksa subdomain mi (www.firma.com) — DNS önerisi buna göre. */
function isApex(domain: string): boolean {
  return domain.split('.').filter(Boolean).length === 2
}

function dnsRecordsFor(domain: string): DomainDnsRecord[] {
  return isApex(domain)
    ? [{ type: 'A', name: '@', value: '76.76.21.21' }]
    : [{ type: 'CNAME', name: domain.split('.')[0], value: 'cname.vercel-dns.com' }]
}

/** Domaini projeye ekler. Zaten varsa (409) yine başarı sayılır. DNS kayıtlarını + doğrulama durumunu döner. */
export async function attachDomain(projectId: string, domain: string): Promise<DomainAttachResult> {
  if (!isVercelDomainReady()) return { ok: false, verified: false, records: [], error: 'VERCEL_NOT_CONFIGURED' }
  const add = await vfetch(`/v10/projects/${projectId}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  })
  const conflict = add.status === 409
  if (!(add.status >= 200 && add.status < 300) && !conflict) {
    const err = (add.body as { error?: { message?: string } })?.error?.message || `HTTP ${add.status}`
    return { ok: false, verified: false, records: [], error: err }
  }
  // Doğrulama durumu
  const conf = await vfetch(`/v6/domains/${domain}/config`, { method: 'GET' })
  const misconfigured = (conf.body as { misconfigured?: boolean })?.misconfigured
  const verified = misconfigured === false
  return { ok: true, verified, records: dnsRecordsFor(domain) }
}

/** Mevcut domainin DNS doğrulama durumunu + gereken kayıtları döner. */
export async function checkDomainConfig(domain: string): Promise<{ verified: boolean; records: DomainDnsRecord[] }> {
  const records = dnsRecordsFor(domain)
  if (!isVercelDomainReady()) return { verified: false, records }
  const conf = await vfetch(`/v6/domains/${domain}/config`, { method: 'GET' })
  const misconfigured = (conf.body as { misconfigured?: boolean })?.misconfigured
  return { verified: misconfigured === false, records }
}

/** Domaini projeden çıkarır. */
export async function removeDomain(projectId: string, domain: string): Promise<boolean> {
  if (!isVercelDomainReady()) return false
  const res = await vfetch(`/v9/projects/${projectId}/domains/${domain}`, { method: 'DELETE' })
  return res.status >= 200 && res.status < 300
}
