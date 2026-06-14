import 'server-only'
import * as cheerio from 'cheerio'

/**
 * Referans sitelerden tasarım/yapı/ton ipuçları çıkarır (GERÇEK HTTP tarama, hata-toleranslı).
 * AI bunları İLHAM olarak kullanır; birebir kopya ÜRETMEZ. Mock/sahte yok — gerçekten fetch eder.
 */

async function scanOne(rawUrl: string): Promise<string | null> {
  try {
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YoAiBot/1.0)' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = (await res.text()).slice(0, 400_000)
    const $ = cheerio.load(html)
    const title = $('title').first().text().trim().replace(/\s+/g, ' ').slice(0, 120)
    const desc = (
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      ''
    ).trim().slice(0, 220)
    const themeColor = $('meta[name="theme-color"]').attr('content')?.trim() || ''
    const headings = $('h1, h2')
      .map((_, el) => $(el).text().trim().replace(/\s+/g, ' '))
      .get()
      .filter(Boolean)
      .slice(0, 8)
    const ctas = $('a.button, a.btn, button, [class*="cta"]')
      .map((_, el) => $(el).text().trim().replace(/\s+/g, ' '))
      .get()
      .filter((x) => x && x.length < 40)
      .slice(0, 5)

    const parts: string[] = [`URL: ${url}`]
    if (title) parts.push(`Başlık: ${title}`)
    if (desc) parts.push(`Açıklama: ${desc}`)
    if (themeColor) parts.push(`Tema rengi: ${themeColor}`)
    if (headings.length) parts.push(`Bölüm başlıkları: ${headings.join(' / ')}`)
    if (ctas.length) parts.push(`CTA örnekleri: ${ctas.join(', ')}`)
    return parts.length > 1 ? parts.join(' | ') : null
  } catch {
    return null
  }
}

export async function scanReferences(urls: string[]): Promise<string[]> {
  const cleaned = urls.map((u) => u.trim()).filter(Boolean).slice(0, 3)
  if (cleaned.length === 0) return []
  const results = await Promise.all(cleaned.map(scanOne))
  return results.filter((x): x is string => Boolean(x))
}
