/* DijiMagic — Firecrawl REST v2 client.
   Apify pattern'i ile aynı: isFirecrawlReady() flag + key kontrolü;
   hata/limit/timeout durumunda çağıran taraf HTTP fetch'e düşer. */
import type { FirecrawlPage, MapLink } from './types'

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v2'
const MAP_TIMEOUT_MS = 15_000
const SCRAPE_TIMEOUT_MS = 25_000

/** Apify'daki isApifyReady deseninin aynısı: key + default-off flag */
export function isFirecrawlReady(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY && process.env.FIRECRAWL_ENABLED === 'true')
}

function apiKey(): string {
  return process.env.FIRECRAWL_API_KEY || ''
}

async function firecrawlRequest<T>(path: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${FIRECRAWL_API_BASE}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    clearTimeout(timeout)
    if (!res.ok) {
      throw new Error(`firecrawl_http_${res.status}`)
    }
    const json = (await res.json()) as { success?: boolean } & T
    if (json && json.success === false) {
      throw new Error('firecrawl_unsuccessful')
    }
    return json as T
  } catch (e) {
    clearTimeout(timeout)
    throw e instanceof Error ? e : new Error('firecrawl_unknown_error')
  }
}

/** Site URL listesini döndürür (string veya {url,...} obje formatını normalize eder) */
export async function firecrawlMap(url: string, limit = 50): Promise<MapLink[]> {
  const json = await firecrawlRequest<{ links?: Array<MapLink | string> }>(
    '/map',
    { url, limit, sitemap: 'include', ignoreQueryParameters: true },
    MAP_TIMEOUT_MS,
  )
  const links = json.links || []
  return links
    .map((l) => (typeof l === 'string' ? { url: l } : l))
    .filter((l): l is MapLink => !!l && !!l.url)
}

/** Tek sayfayı temiz markdown olarak çeker; markdown yoksa null */
export async function firecrawlScrape(url: string): Promise<FirecrawlPage | null> {
  const json = await firecrawlRequest<{
    data?: {
      markdown?: string
      metadata?: { title?: string | string[]; description?: string | string[] }
    }
  }>('/scrape', { url, formats: ['markdown'], onlyMainContent: true, timeout: SCRAPE_TIMEOUT_MS }, SCRAPE_TIMEOUT_MS + 5_000)

  const data = json.data
  if (!data || !data.markdown) return null

  const firstStr = (v: string | string[] | undefined): string | null =>
    Array.isArray(v) ? v[0] || null : v || null

  return {
    url,
    title: firstStr(data.metadata?.title),
    description: firstStr(data.metadata?.description),
    markdown: data.markdown,
  }
}
