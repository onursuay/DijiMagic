/* YoAi — Firecrawl kilit sayfa seçici (deterministik).
   map çıktısından markaya dair en bilgilendirici sayfaları seçer. */
import type { MapLink } from './types'

/** rank düşük = öncelik yüksek */
const PAGE_PRIORITY: Array<{ rank: number; pattern: RegExp }> = [
  { rank: 1, pattern: /\/(hakk|about|kurumsal|biz-kimiz|who-we-are)/i },
  { rank: 2, pattern: /\/(hizmet|service|cozum|solution|urun|product|shop|magaza|katalog|collection)/i },
  { rank: 3, pattern: /\/(fiyat|pricing|paket|plan|ucret|price)/i },
  { rank: 4, pattern: /\/(iletisim|contact|ulasim|destek)/i },
]

function pathOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname.replace(/\/+$/, '') || '/'
  } catch {
    return rawUrl
  }
}

function rankFor(url: string): number {
  const path = pathOf(url)
  if (path === '/' || path === '') return 0 // anasayfa
  for (const { rank, pattern } of PAGE_PRIORITY) {
    if (pattern.test(path)) return rank
  }
  return 99 // diğer
}

/** rootUrl her zaman dahil; kalan sayfalar önceliğe göre sıralanıp max'a kadar alınır. */
export function selectKeyPages(rootUrl: string, links: MapLink[], max = 6): string[] {
  const seen = new Set<string>()
  const candidates: Array<{ url: string; rank: number }> = []

  candidates.push({ url: rootUrl, rank: 0 })
  seen.add(pathOf(rootUrl))

  for (const link of links) {
    if (!link.url) continue
    const norm = pathOf(link.url)
    if (seen.has(norm)) continue
    seen.add(norm)
    candidates.push({ url: link.url, rank: rankFor(link.url) })
  }

  return candidates
    .sort((a, b) => a.rank - b.rank)
    .slice(0, max)
    .map((c) => c.url)
}
