/* ──────────────────────────────────────────────────────────
   Landing Page Analyzer

   Fetches a URL, extracts title / meta description / headings
   / visible body text, returns a normalized summary string.

   Non-destructive: every error path returns a partial result;
   the engine never throws. Callers treat null / error gracefully.
   ────────────────────────────────────────────────────────── */

export interface LandingPageAnalysis {
  url: string
  title?: string
  metaDescription?: string
  h1?: string
  headings: string[]
  bodyText: string
  summary: string
  fetchedAt: string
  error?: string
}

const FETCH_TIMEOUT_MS = 8_000
const BODY_TEXT_MAX_CHARS = 3_000

// ── HTML helpers ──────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTag(html: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = html.match(re)
  if (!m) return undefined
  const text = stripHtml(m[1]).trim()
  return text.length > 0 ? text.slice(0, 300) : undefined
}

function extractMeta(html: string, attr: string): string | undefined {
  // Handles: <meta name="X" content="Y"> and <meta content="Y" name="X">
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${attr}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${attr}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1].trim().slice(0, 300)
  }
  return undefined
}

function extractAllHeadings(html: string): string[] {
  const results: string[] = []
  for (const tag of ['h1', 'h2', 'h3'] as const) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const text = stripHtml(m[1]).trim()
      if (text) results.push(text.slice(0, 150))
    }
    if (results.length >= 12) break
  }
  return results.slice(0, 12)
}

function buildSummary(parts: {
  title?: string
  metaDescription?: string
  h1?: string
  headings: string[]
  bodyText: string
}): string {
  const lines: string[] = []
  if (parts.title) lines.push(`Başlık: ${parts.title}`)
  if (parts.metaDescription) lines.push(`Meta: ${parts.metaDescription}`)
  if (parts.h1) lines.push(`H1: ${parts.h1}`)
  const subHeadings = parts.headings.filter(h => h !== parts.h1).slice(0, 4)
  if (subHeadings.length > 0) lines.push(`Alt başlıklar: ${subHeadings.join(' | ')}`)
  if (parts.bodyText) lines.push(`İçerik: ${parts.bodyText.slice(0, 600)}`)
  return lines.join('\n')
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyzeLandingPage(url: string): Promise<LandingPageAnalysis | null> {
  const fetchedAt = new Date().toISOString()

  // Basic URL sanity check — skip obviously invalid URLs
  if (!url || !/^https?:\/\/.+/i.test(url)) {
    return { url, headings: [], bodyText: '', summary: '', fetchedAt, error: 'Geçersiz URL' }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let html: string

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'YoAi-Intent-Bot/1.0 (compatible; campaign-analysis)',
          Accept: 'text/html,application/xhtml+xml',
        },
      })
      clearTimeout(timer)

      if (!res.ok) {
        return {
          url, headings: [], bodyText: '', summary: '', fetchedAt,
          error: `HTTP ${res.status}`,
        }
      }

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('html') && !contentType.includes('text')) {
        return {
          url, headings: [], bodyText: '', summary: '', fetchedAt,
          error: `HTML olmayan içerik: ${contentType.split(';')[0]}`,
        }
      }

      html = await res.text()
    } catch (fetchErr) {
      clearTimeout(timer)
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      const isTimeout = msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout')
      return {
        url, headings: [], bodyText: '', summary: '', fetchedAt,
        error: isTimeout ? 'Timeout (8s)' : `Fetch hatası: ${msg.slice(0, 120)}`,
      }
    }

    const title = extractTag(html, 'title')
    const metaDescription =
      extractMeta(html, 'description') ||
      extractMeta(html, 'og:description') ||
      extractMeta(html, 'twitter:description')

    const headings = extractAllHeadings(html)
    const h1 = headings[0]

    // Extract visible body text from <body> only (ignore head)
    const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i)
    const bodyHtml = bodyMatch ? bodyMatch[0] : html
    const bodyText = stripHtml(bodyHtml).slice(0, BODY_TEXT_MAX_CHARS)

    const partial = { url, title, metaDescription, h1, headings, bodyText, fetchedAt }
    const summary = buildSummary(partial)

    return { ...partial, summary }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      url, headings: [], bodyText: '', summary: '', fetchedAt,
      error: `Beklenmedik hata: ${msg.slice(0, 120)}`,
    }
  }
}
