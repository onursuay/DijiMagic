import 'server-only'
import * as cheerio from 'cheerio'
import { lookup } from 'dns/promises'
import net from 'net'

/**
 * Referans sitelerden tasarım/yapı/ton ipuçları çıkarır (GERÇEK HTTP tarama, hata-toleranslı).
 * AI bunları İLHAM olarak kullanır; birebir kopya ÜRETMEZ.
 *
 * GÜVENLİK (SSRF koruması): URL kullanıcı girdisidir ve sunucuda fetch edilir.
 *  - Yalnız http/https; hostname DNS'te çözülür ve TÜM çözülen IP'ler genel (public) olmalı.
 *  - Loopback/private/link-local/metadata (169.254.169.254) IP'leri reddedilir.
 *  - Yönlendirmeler MANUEL; her adımın hedefi aynı politikadan yeniden geçer; hop sınırı 4.
 */

function ipv4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!m) return null
  const o = m.slice(1).map(Number)
  if (o.some((n) => n > 255)) return null
  return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3]
}

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToInt(base)
    if (b === null) return false
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
    return (n & mask) === (b & mask)
  }
  return (
    inRange('0.0.0.0', 8) || inRange('10.0.0.0', 8) || inRange('100.64.0.0', 10) ||
    inRange('127.0.0.0', 8) || inRange('169.254.0.0', 16) || inRange('172.16.0.0', 12) ||
    inRange('192.0.0.0', 24) || inRange('192.0.2.0', 24) || inRange('192.168.0.0', 16) ||
    inRange('198.18.0.0', 15) || inRange('198.51.100.0', 24) || inRange('203.0.113.0', 24) ||
    inRange('224.0.0.0', 4) || inRange('240.0.0.0', 4)
  )
}

function isBlockedIp(ip: string): boolean {
  const type = net.isIP(ip)
  if (type === 4) return isBlockedIpv4(ip)
  if (type === 6) {
    const low = ip.toLowerCase()
    if (low === '::1' || low === '::') return true
    const mapped = low.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isBlockedIpv4(mapped[1])
    if (/^f[cd]/.test(low)) return true // fc00::/7 ULA
    if (/^fe[89ab]/.test(low)) return true // fe80::/10 link-local
    return false
  }
  return true
}

/** Hostname'i çözer; TÜM IP'ler public değilse reddeder (DNS-rebinding'e karşı). */
async function assertSafeHost(host: string): Promise<void> {
  const h = host.toLowerCase()
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) {
    throw new Error('BLOCKED_HOST')
  }
  if (net.isIP(h) && isBlockedIp(h)) throw new Error('BLOCKED_IP_LITERAL')
  const addrs = await lookup(h, { all: true, verbatim: true })
  if (addrs.length === 0) throw new Error('NO_DNS')
  for (const a of addrs) {
    if (isBlockedIp(a.address)) throw new Error('BLOCKED_IP')
  }
}

async function safeFetch(rawUrl: string): Promise<Response | null> {
  let current: URL
  try {
    current = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`)
  } catch {
    return null
  }
  for (let hop = 0; hop < 4; hop++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') return null
    await assertSafeHost(current.hostname) // güvenli değilse fırlatır → scanOne yakalar
    const res = await fetch(current.toString(), {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YoAiBot/1.0)' },
      redirect: 'manual',
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return null
      current = new URL(loc, current) // her hop yeniden doğrulanır
      continue
    }
    return res
  }
  return null
}

async function scanOne(rawUrl: string): Promise<string | null> {
  try {
    const res = await safeFetch(rawUrl)
    if (!res || !res.ok) return null
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

    const parts: string[] = [`URL: ${res.url || rawUrl}`]
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
