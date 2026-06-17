import 'server-only'
import type { PublishedSite, WebsitePage } from '../types'

/**
 * lib/website/render/serveCommon.ts
 *
 * Route Handler tabanlı `/s/` servisi için ortak yardımcılar (home + slug paylaşır):
 *   - pickLocale          : eski page.tsx ile birebir aynı locale seçimi
 *   - findPageBySlug      : slug → sayfa (locale eşleşmesi öncelikli, fallback locale-bağımsız)
 *   - SITE_CSP            : next.config.mjs'deki `/s/:path*` ile BİREBİR aynı CSP policy string
 *                           (defense-in-depth: response başlığına da yazılır)
 */

/** Eski page.tsx ile birebir aynı: lang locale listesindeyse onu, değilse defaultLocale'i seç. */
export function pickLocale(locales: string[], defaultLocale: string, lang?: string): string {
  return lang && locales.includes(lang) ? lang : defaultLocale
}

/**
 * Slug'a göre sayfa bul — eski page.tsx mantığı birebir:
 *   önce (locale === seçili && slug eşleşen), yoksa (slug eşleşen herhangi bir locale).
 */
export function findPageBySlug(
  site: PublishedSite,
  slug: string,
  locale: string,
): WebsitePage | undefined {
  return (
    site.pages.find((p) => p.locale === locale && p.slug === slug) ??
    site.pages.find((p) => p.slug === slug)
  )
}

/**
 * Anasayfa bul — eski page.tsx mantığı birebir:
 *   önce (locale === seçili && slug==='home'), yoksa (slug==='home'), yoksa ilk sayfa.
 */
export function findHomePage(site: PublishedSite, locale: string): WebsitePage | undefined {
  return (
    site.pages.find((p) => p.locale === locale && p.slug === 'home') ??
    site.pages.find((p) => p.slug === 'home') ??
    site.pages[0]
  )
}

/** url-safe slug deseni — assembleDocument.mjs SAFE_SLUG_RE ile birebir aynı. */
const SAFE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Bir sitede GERÇEKTEN var olan sayfaların slug kümesi (anasayfa 'home' DAHİL) —
 * assembleDocument nav rewrite'ı slug-set-aware yapmak için. Yalnız url-safe slug'lar
 * alınır (data-yoai-href yalnız bunlara çözülür); 'home' her zaman dahildir. Tüm locale'ler
 * birleştirilir — nav her dilde aynı sayfa listesine bakar; liste-dışı slug → anasayfa.
 */
export function collectKnownSlugs(site: PublishedSite): string[] {
  const set = new Set<string>(['home'])
  for (const p of site.pages) {
    if (typeof p.slug === 'string' && SAFE_SLUG_RE.test(p.slug)) set.add(p.slug)
  }
  return Array.from(set)
}

/**
 * `/s/:path*` için next.config.mjs'de tanımlı CSP ile BİREBİR aynı policy string.
 * Next config `headers()` bu path'e zaten uygular (route handler dahil); ayrıca response
 * başlığına yazmak defense-in-depth sağlar — yeni bir policy ICAT EDİLMEZ, aynısı kullanılır.
 */
export const SITE_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' https: data:",
  "font-src https://fonts.gstatic.com",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ')
