import 'server-only'
import * as cheerio from 'cheerio'
import type { DetectedAction, RecommendedEvent, SiteScanResult } from './types'
import { STANDARD_EVENTS, type StandardEventKey } from './constants'
import { claudeJson, isClaudeReady } from '@/lib/anthropic/text'

/**
 * Scans a website with Firecrawl v2 (https://api.firecrawl.dev) to detect
 * conversion-worthy actions (purchase / add-to-cart / search / lead forms /
 * sign-up / video) and map them to the STANDARD_EVENTS catalog.
 *
 * Strategy:
 *   1. /v2/crawl with a bounded page limit → discover up to ~20 pages of the
 *      site, returning each page's HTML + links.
 *   2. For every crawled page, run deterministic HTML heuristics to detect
 *      actions and tally them into recommended events.
 *
 * Real Firecrawl calls only. If FIRECRAWL_API_KEY is missing this throws — we
 * never fabricate a scan result.
 */

const FIRECRAWL_BASE = 'https://api.firecrawl.dev'
const MAX_PAGES = 20
// Firecrawl crawl is async; poll its status until done (or until we hit the cap).
const CRAWL_POLL_INTERVAL_MS = 2500
const CRAWL_MAX_POLLS = 20 // ~50s ceiling — stays under serverless limits

interface FirecrawlPage {
  html?: string
  rawHtml?: string
  markdown?: string
  links?: string[]
  metadata?: { sourceURL?: string; url?: string; statusCode?: number }
}

interface CrawlStartResponse {
  success?: boolean
  id?: string
  url?: string
  error?: string
}

interface CrawlStatusResponse {
  success?: boolean
  status?: 'scraping' | 'completed' | 'failed' | 'cancelled'
  total?: number
  completed?: number
  data?: FirecrawlPage[]
  next?: string
  error?: string
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Best page URL for an action source label. */
function pageUrl(page: FirecrawlPage, fallback: string): string {
  return page.metadata?.sourceURL || page.metadata?.url || fallback
}

// ─── Detection heuristics ─────────────────────────────────────────────────────
// Each rule inspects normalized page HTML (lowercased) and emits zero or more
// DetectedAction entries. Confidence reflects how unambiguous the signal is.

interface Rule {
  event: StandardEventKey
  via: string
  confidence: number
  /** Returns true if the (lowercased) html exhibits the signal. */
  test: (html: string) => boolean
}

// CTA / button text patterns. Cover EN + TR e-commerce vocabulary since the
// product serves Turkish merchants.
const RULES: Rule[] = [
  // Purchase — strongest commerce intent.
  {
    event: 'purchase',
    via: 'cta',
    confidence: 0.9,
    test: (h) =>
      /(?:complete\s+(?:purchase|order)|place\s+order|buy\s+now|pay\s+now|confirm\s+(?:order|payment))/.test(h) ||
      /(sat[ıi]n\s+al|hemen\s+al|sipari[sş]i?\s+(?:tamamla|onayla)|[öo]demeyi?\s+tamamla|sipari[sş]\s+ver)/.test(h),
  },
  // Begin checkout.
  {
    event: 'begin_checkout',
    via: 'checkout',
    confidence: 0.85,
    test: (h) =>
      /(?:proceed\s+to\s+checkout|go\s+to\s+checkout|checkout|secure\s+checkout)/.test(h) ||
      /(?:[öo]demeye\s+ge[cç]|sepeti\s+onayla|kasa(?:ya)?\s+(?:git|ge[cç])|al[ıi][sş]veri[sş]i\s+tamamla)/.test(h) ||
      /href=["'][^"']*\/(checkout|cart\/checkout|odeme|sepet\/odeme)/.test(h),
  },
  // Add payment info — payment form/fields.
  {
    event: 'add_payment_info',
    via: 'form',
    confidence: 0.7,
    test: (h) =>
      /(?:card\s*number|cardnumber|cc-number|credit\s*card|payment\s*(?:method|details|information))/.test(h) ||
      /(?:kart\s*numaras[ıi]|kredi\s*kart[ıi]|[öo]deme\s*bilgileri|[öo]deme\s*y[öo]ntemi)/.test(h) ||
      /autocomplete=["']cc-(?:number|exp|csc)["']/.test(h),
  },
  // Add to cart.
  {
    event: 'add_to_cart',
    via: 'cta',
    confidence: 0.85,
    test: (h) =>
      /(?:add\s+to\s+(?:cart|bag|basket)|add-to-cart|addtocart|data-add-to-cart)/.test(h) ||
      /(?:sepete\s+ekle|sepete\s+at|sepete-ekle)/.test(h),
  },
  // Lead — contact / quote / demo forms.
  {
    event: 'lead',
    via: 'form',
    confidence: 0.75,
    test: (h) =>
      /(?:contact\s+(?:us|form)|get\s+a\s+quote|request\s+(?:a\s+)?(?:quote|demo|callback)|free\s+(?:quote|consultation))/.test(h) ||
      /(?:teklif\s+al|bize\s+ula[sş][ıi]n|[ıi]leti[sş]im\s+formu|geri\s+aranma|[uü]cretsiz\s+(?:teklif|dan[ıi][sş]ma)|ba[sş]vuru\s+formu)/.test(h) ||
      /(?:type=["']tel["'])/.test(h),
  },
  // Sign up / register.
  {
    event: 'sign_up',
    via: 'form',
    confidence: 0.8,
    test: (h) =>
      /(?:sign\s*up|sign-up|signup|create\s+(?:an\s+)?account|register(?:\s+now)?|join\s+(?:us|now))/.test(h) ||
      /(?:[üu]ye\s+ol|kay[ıi]t\s+ol|hesap\s+olu[sş]tur|yeni\s+[üu]yelik)/.test(h),
  },
  // Video player presence.
  {
    event: 'video_play',
    via: 'video',
    confidence: 0.6,
    test: (h) =>
      /(?:<video[\s>]|youtube\.com\/embed|player\.vimeo\.com|wistia|<iframe[^>]+(?:youtube|vimeo))/.test(h),
  },
  // ── İletişim kanalları ──────────────────────────────────────────────────────
  // Bu hedefler sitenin kendi kodunda VEYA chat/click-to-chat eklentilerinin
  // enjekte ettiği link/butonlarda bulunur. Tıklanabilir öğelerin hedef+metni de
  // haystack'e katıldığı için eklenti butonları da yakalanır.
  // WhatsApp — wa.me / api.whatsapp.com / whatsapp:// (kesin sinyal, yüksek güven).
  {
    event: 'contact_whatsapp',
    via: 'chat',
    confidence: 0.9,
    test: (h) =>
      /(?:wa\.me\/|wa\.link\/|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send|whatsapp:\/\/send)/.test(h),
  },
  // Messenger — m.me / messenger.com/t / fb-messenger://
  {
    event: 'contact_messenger',
    via: 'chat',
    confidence: 0.85,
    test: (h) => /(?:m\.me\/|messenger\.com\/t\/|fb-messenger:\/\/)/.test(h),
  },
  // Instagram DM — ig.me / instagram.com/direct
  {
    event: 'contact_instagram',
    via: 'chat',
    confidence: 0.8,
    test: (h) => /(?:ig\.me\/m\/|ig\.me\/|instagram\.com\/direct)/.test(h),
  },
  // Telefon — tel: / callto: (footer'da yaygın → daha düşük güven).
  {
    event: 'contact_phone',
    via: 'call',
    confidence: 0.65,
    test: (h) => /(?:href=["']tel:|["'`]tel:\+?\d|callto:\+?\d)/.test(h),
  },
  // E-posta — mailto: (footer'da yaygın → daha düşük güven).
  {
    event: 'contact_email',
    via: 'email',
    confidence: 0.6,
    test: (h) => /mailto:[^"'\s]+@/.test(h),
  },
]

function detectOnPage(rawHtml: string, source: string): DetectedAction[] {
  const html = rawHtml.toLowerCase()
  const actions: DetectedAction[] = []
  const seen = new Set<string>()
  for (const rule of RULES) {
    if (rule.test(html)) {
      const dedupeKey = `${rule.event}|${rule.via}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      actions.push({ event: rule.event, source, via: rule.via, confidence: rule.confidence })
    }
  }
  return actions
}

// ─── Tıklanabilir öğe çıkarma (gerçek DOM) ───────────────────────────────────
// Render edilmiş HTML'den TÜM tıklanabilir öğeleri (a, button, [onclick],
// [data-href]) çıkarır — sitenin KENDİ kodu + chat/click-to-chat EKLENTİLERİNİN
// enjekte ettiği butonlar dahil. Kullanıcının F12 console script'inin sunucu eşdeğeri:
//   document.querySelectorAll('a, button, [onclick], [data-href]')
export interface ClickableElement {
  tag: string
  text: string
  target: string
}

function extractClickables(rawHtml: string): ClickableElement[] {
  let $: ReturnType<typeof cheerio.load>
  try {
    $ = cheerio.load(rawHtml)
  } catch {
    return []
  }
  const out: ClickableElement[] = []
  $('a, button, [onclick], [data-href]').each((_i, el) => {
    const $el = $(el)
    const node = el as { tagName?: string; name?: string }
    const tag = String(node.tagName ?? node.name ?? '').toLowerCase()
    const text = $el.text().replace(/\s+/g, ' ').trim().slice(0, 80)
    const target = ($el.attr('href') || $el.attr('onclick') || $el.attr('data-href') || '').slice(0, 300)
    if (text || target) out.push({ tag, text, target })
  })
  return out
}

// ─── AI sınıflandırma (Claude) ───────────────────────────────────────────────
// Çıkarılan tıklanabilir öğeleri Claude'a verip hangi standart event'lerin
// gerçekten mevcut olduğunu belirler — deterministik kuralların kaçırdığı veya
// belirsiz butonları (ör. onclick ile WhatsApp açan "Bize Ulaşın") yakalar.
// ANTHROPIC_API_KEY yoksa boş set döner → deterministik sonuç korunur (fallback).
async function classifyClickablesWithClaude(
  clickables: ClickableElement[],
): Promise<Set<StandardEventKey>> {
  const found = new Set<StandardEventKey>()
  if (!isClaudeReady() || clickables.length === 0) return found

  // Token sınırı için dedup + ilk 250 benzersiz öğe.
  const seen = new Set<string>()
  const sample: ClickableElement[] = []
  for (const c of clickables) {
    const k = `${c.text}|${c.target}`.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    sample.push(c)
    if (sample.length >= 250) break
  }

  const validKeys = STANDARD_EVENTS.map((e) => e.key)
  const list = sample.map((c, i) => `${i + 1}. <${c.tag}> "${c.text}" -> ${c.target}`).join('\n')

  const result = await claudeJson<{ events: string[] }>({
    system:
      "Sen bir web analitik uzmanısın. Bir web sayfasındaki tıklanabilir öğeleri " +
      "(link/buton) inceleyip hangi standart dönüşüm/etkileşim event'lerinin gerçekten " +
      'mevcut olduğunu tespit edersin. WhatsApp / telefon / Instagram DM / Messenger / e-posta ' +
      'gibi iletişim butonlarını (chat veya click-to-chat eklentileri dahil) ve satın alma, ' +
      'sepete ekleme, arama, form/lead, kayıt gibi aksiyonları değerlendir. SADECE sana verilen ' +
      'anahtar listesinden seç; emin olmadığın bir anahtarı ekleme.',
    user:
      `Geçerli event anahtarları: ${validKeys.join(', ')}\n\n` +
      `Tıklanabilir öğeler:\n${list}\n\n` +
      'Bu öğelerden hangi event anahtarları bu sitede mevcut? Yalnızca şu biçimde JSON döndür: ' +
      '{"events":["anahtar1","anahtar2"]}',
    maxTokens: 800,
    temperature: 0,
    timeoutMs: 30000,
  })

  for (const k of result?.events ?? []) {
    if ((validKeys as string[]).includes(k)) found.add(k as StandardEventKey)
  }
  return found
}

/** Build deduped recommendedEvents from the full detectedActions list. */
function buildRecommended(actions: DetectedAction[]): RecommendedEvent[] {
  const byEvent = new Map<StandardEventKey, { hits: number; maxConfidence: number }>()
  for (const a of actions) {
    const cur = byEvent.get(a.event)
    if (cur) {
      cur.hits += 1
      cur.maxConfidence = Math.max(cur.maxConfidence, a.confidence)
    } else {
      byEvent.set(a.event, { hits: 1, maxConfidence: a.confidence })
    }
  }
  const recommended: RecommendedEvent[] = []
  for (const [event, { hits, maxConfidence }] of byEvent) {
    // More hits → higher confidence, capped at the rule's own ceiling.
    const confidence = Math.min(1, maxConfidence + Math.min(0.1, (hits - 1) * 0.02))
    recommended.push({ event, hits, confidence: Number(confidence.toFixed(2)) })
  }
  // Sort by hits desc, then confidence desc for a stable, useful order.
  recommended.sort((a, b) => b.hits - a.hits || b.confidence - a.confidence)
  return recommended
}

function normalizeSiteUrl(siteUrl: string): string {
  const trimmed = (siteUrl || '').trim()
  if (!trimmed) throw new Error('marketing_setup_scan_no_url')
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export async function scanSite(siteUrl: string): Promise<SiteScanResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not configured — cannot scan site.')
  }

  const url = normalizeSiteUrl(siteUrl)

  // ── 1. Kick off a bounded crawl ──────────────────────────────────────────
  const startRes = await fetch(`${FIRECRAWL_BASE}/v2/crawl`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      url,
      limit: MAX_PAGES,
      crawlEntireDomain: false,
      scrapeOptions: {
        // rawHtml gives us the full markup needed for heuristic detection;
        // links lets us account for checkout/cart routes referenced via href.
        formats: ['rawHtml', 'links'],
        onlyMainContent: false,
        // Chat / click-to-chat (WhatsApp, telefon, Instagram DM) eklenti butonları
        // client-side JS ile enjekte edilir; render bitmeden HTML alınırsa wa.me/tel
        // linkleri rawHtml+links'te HİÇ görünmez. Render için bekle (eklenti tespiti şart).
        waitFor: 3500,
      },
    }),
  })

  if (!startRes.ok) {
    const body = await startRes.text().catch(() => '')
    throw new Error(`Firecrawl crawl start failed (${startRes.status}): ${body.slice(0, 300)}`)
  }

  const startJson = (await startRes.json()) as CrawlStartResponse
  if (!startJson.id) {
    throw new Error(`Firecrawl crawl start returned no job id: ${startJson.error ?? 'unknown error'}`)
  }
  const jobId = startJson.id

  // ── 2. Poll the crawl until it completes (or we hit the cap) ──────────────
  const pages: FirecrawlPage[] = []
  let truncated = false
  let finalStatus: CrawlStatusResponse['status'] = 'scraping'

  for (let i = 0; i < CRAWL_MAX_POLLS; i++) {
    await sleep(CRAWL_POLL_INTERVAL_MS)
    const statusRes = await fetch(`${FIRECRAWL_BASE}/v2/crawl/${jobId}`, {
      method: 'GET',
      headers: authHeaders(apiKey),
    })
    if (!statusRes.ok) {
      const body = await statusRes.text().catch(() => '')
      throw new Error(`Firecrawl crawl status failed (${statusRes.status}): ${body.slice(0, 300)}`)
    }
    const statusJson = (await statusRes.json()) as CrawlStatusResponse
    finalStatus = statusJson.status

    if (Array.isArray(statusJson.data)) {
      // Collect newly returned pages (the status endpoint returns accumulated data).
      pages.length = 0
      pages.push(...statusJson.data)
    }

    if (statusJson.status === 'completed') break
    if (statusJson.status === 'failed' || statusJson.status === 'cancelled') {
      throw new Error(`Firecrawl crawl ${statusJson.status}: ${statusJson.error ?? 'no detail'}`)
    }
    if (pages.length >= MAX_PAGES) {
      truncated = true
      break
    }
    if (i === CRAWL_MAX_POLLS - 1) {
      truncated = true // ran out of polling budget; use what we have
    }
  }

  // Fallback: if a crawl yielded zero pages (e.g. JS-only landing), scrape the
  // single entry URL directly so we still return real signal for one page.
  if (pages.length === 0) {
    const scrapeRes = await fetch(`${FIRECRAWL_BASE}/v2/scrape`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ url, formats: ['rawHtml', 'links'], onlyMainContent: false, waitFor: 3500 }),
    })
    if (scrapeRes.ok) {
      const scrapeJson = (await scrapeRes.json()) as { success?: boolean; data?: FirecrawlPage }
      if (scrapeJson.data) pages.push(scrapeJson.data)
    }
    if (pages.length === 0) {
      throw new Error(
        `Firecrawl returned no pages for ${url} (crawl status: ${finalStatus ?? 'unknown'}).`,
      )
    }
  }

  const cappedPages = pages.slice(0, MAX_PAGES)
  if (pages.length > MAX_PAGES) truncated = true

  // ── 3. Detect actions on each page ────────────────────────────────────────
  // Her sayfa için: (a) gerçek DOM'dan tıklanabilir öğeleri çıkar (site kodu +
  // eklenti butonları), (b) markup + linkler + tıklanabilir hedef/metinler üzerinde
  // deterministik kuralları çalıştır.
  const detectedActions: DetectedAction[] = []
  const allClickables: ClickableElement[] = []
  for (const page of cappedPages) {
    const html = page.rawHtml || page.html || ''
    const clickables = extractClickables(html)
    allClickables.push(...clickables)
    const linkBlob = Array.isArray(page.links) ? page.links.join(' ') : ''
    // Tıklanabilir öğelerin hedef+metni de haystack'e katılır → eklenti-enjekte
    // WhatsApp/telefon/DM butonları (wa.me, tel:, m.me, ig.me, mailto:) yakalanır.
    const clickBlob = clickables.map((c) => `${c.target} ${c.text}`).join(' ')
    const haystack = `${html} ${linkBlob} ${clickBlob}`
    if (!haystack.trim()) continue
    detectedActions.push(...detectOnPage(haystack, pageUrl(page, url)))
  }

  // ── AI katmanı (Claude) ────────────────────────────────────────────────────
  // Çıkarılan tüm tıklanabilir öğeleri Claude'a verip deterministik kuralların
  // kaçırdığı/belirsiz event'leri yakala (ör. onclick ile WhatsApp açan buton).
  // Non-fatal: hata/anahtar yoksa deterministik sonuç korunur.
  try {
    const aiKeys = await classifyClickablesWithClaude(allClickables)
    for (const key of aiKeys) {
      if (!detectedActions.some((a) => a.event === key)) {
        detectedActions.push({ event: key, source: url, via: 'ai', confidence: 0.7 })
      }
    }
  } catch {
    /* AI sınıflandırma hatası non-fatal — deterministik sonuç geçerli kalır */
  }

  if (truncated) {
    console.log('MARKETING_SETUP_SCAN_TRUNCATED', {
      url,
      pagesScanned: cappedPages.length,
      cap: MAX_PAGES,
    })
  }

  const recommendedEvents = buildRecommended(detectedActions)

  return {
    siteUrl: url,
    pagesScanned: cappedPages.length,
    detectedActions,
    recommendedEvents,
    scannedAt: new Date().toISOString(),
    truncated,
  }
}
