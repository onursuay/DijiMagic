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

/**
 * ISR/CDN performans bayrağı (perf lever, DEFAULT-OFF). WEBSITE_ISR='1' DEĞİLSE
 * davranış BUGÜNKÜYLE BİREBİR aynıdır — hiçbir cache başlığı eklenmez (route
 * `dynamic='force-dynamic'`; Next.js dinamik route handler'a no-store uygular →
 * hiç cache YOK). Açıkken yalnız YAYINLANMIŞ + DEĞİŞMEZ (`published_version_id`
 * mevcut) site yanıtına CDN s-maxage başlığı eklenir. Mekanizma HEADER-TABANLI:
 * Response'a açıkça yazılan `Cache-Control` Next'in varsayılan no-store'unu ezer,
 * `dynamic` export'una dokunmadan (flag-off byte-identik kalsın diye). Taslak /
 * yayınlanmamış / preview yanıtları bayrak açık olsa BİLE s-maxage ALMAZ.
 */
function isWebsiteIsrEnabled(): boolean {
  return process.env.WEBSITE_ISR === '1'
}

/**
 * Yayınlanmış bir site yanıtı için CDN cache başlığını (varsa) base header'lara ekler.
 *
 * @param baseHeaders  content-type + CSP gibi her yanıtta olan başlıklar
 * @param site         servis edilen YAYINLANMIŞ site (getPublishedSiteBySubdomain → status='published')
 * @returns yeni headers nesnesi. Bayrak kapalı VEYA site immutable-published değilse base'in AYNISI.
 */
export function withSiteCacheHeaders(
  baseHeaders: Record<string, string>,
  site: PublishedSite,
): Record<string, string> {
  // Bayrak kapalı → bugünkü davranış (cache başlığı YOK). Immutable değilse de (yayın
  // sürümü işaretlenmemiş) güvenli tarafta kal → cache etme.
  if (!isWebsiteIsrEnabled() || !site.website.publishedVersionId) return baseHeaders
  return {
    ...baseHeaders,
    // public: CDN cache'leyebilir; s-maxage=300: edge 5dk taze tutar; SWR=1g: süre dolunca
    // bayat içeriği anında verip arka planda tazeler. published_version_id DEĞİŞMEZ olduğundan
    // yayınlanmış çıktıyı cache'lemek güvenli; yeniden yayında URL aynı/kalır içerik değişir →
    // s-maxage + stale-while-revalidate kademeli-rollout (default-off) bayrağı için kabul edilebilir.
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
  }
}
