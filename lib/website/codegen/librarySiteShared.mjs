/**
 * lib/website/codegen/librarySiteShared.mjs
 *
 * PURE, DEPENDENCY-FREE glue for the 'library' generation MODE (#builder-5a).
 *
 * The 'library' path is: ctx → designSystem → industry-template select → blueprint
 * (Opus, builder-3) → composition (builder-2/3) → renderComponent (builder-1/2) →
 * concat → resolveImagePlaceholders → sanitize → gate (builder-4) → fallback
 * self-repair. The DETERMINISTIC parts of that flow (template inference, seed
 * derivation, and the compose→render→concat body assembly) live HERE so they are:
 *   - importable by BOTH the TS orchestrator (generateHtmlSite.ts) AND
 *     scripts/verify-website-codegen.mjs (plain Node, NO TS build, NO live API),
 *   - testable end-to-end with an INJECTED deterministic blueprint + the REAL
 *     registry render + the REAL gate (the `library-generate` assertion).
 *
 * Mirrors the existing .mjs core pattern (components.mjs / compositionEngine.mjs /
 * blueprintGeneratorShared.mjs): the heavy live calls (Opus blueprint, stock image
 * resolver) stay in the .ts surface; the pure arrangement lives here.
 *
 * IMPORTANT — this module imports NOTHING with side effects. composeBlueprint and
 * renderComponent are passed IN (dependency injection) so this stays a pure leaf.
 */

import { composeBlueprint } from './compositionEngine.mjs'

// ---------------------------------------------------------------------------
// Industry-template inference (Bölüm 4.3) — map a site's category / siteType /
// free-text instruction onto one of the 11 industry template keys. Pure + bounded.
// Returns a known key or null (null → the blueprint falls back to a generic plan).
// ---------------------------------------------------------------------------

/**
 * Keyword → industry-template-key inference table. Each template key carries the
 * Turkish + English signal words a user is likely to type or pick as a category.
 * Order matters only for the FIRST hit; the matcher scans the joined haystack.
 * Every value here MUST be a real key in industryTemplates.mjs.
 */
const TEMPLATE_SIGNALS = [
  ['otel', ['otel', 'hotel', 'konaklama', 'pansiyon', 'motel', 'resort', 'tatil köyü', 'apart']],
  ['restoran', ['restoran', 'restaurant', 'cafe', 'kafe', 'lokanta', 'yemek', 'menü', 'bistro', 'kahve', 'pastane', 'bar']],
  ['feribot-bilet', ['feribot', 'ferry', 'bilet', 'ticket', 'sefer', 'vapur', 'gemi', 'ulaşım', 'transfer']],
  ['klinik', ['klinik', 'clinic', 'sağlık', 'health', 'doktor', 'diş', 'dental', 'hastane', 'tıp', 'estetik', 'fizyoterapi', 'medical']],
  ['ajans', ['ajans', 'agency', 'reklam', 'pazarlama', 'marketing', 'kreatif', 'creative', 'tasarım stüdyo', 'dijital ajans', 'yazılım', 'studio', 'stüdyo']],
  ['e-ticaret', ['e-ticaret', 'eticaret', 'ecommerce', 'e-commerce', 'mağaza', 'shop', 'store', 'ürün satış', 'online satış', 'butik', 'market']],
  ['kurumsal', ['kurumsal', 'corporate', 'b2b', 'holding', 'şirket', 'company', 'sanayi', 'üretim', 'fabrika', 'enterprise', 'danışmanlık', 'consulting', 'hukuk', 'finans', 'muhasebe']],
  ['hizmet-landing', ['hizmet', 'service', 'landing', 'tek sayfa', 'kampanya', 'tamir', 'tesisat', 'temizlik', 'nakliyat', 'usta', 'teknik servis']],
  ['rezervasyon', ['rezervasyon', 'reservation', 'randevu', 'appointment', 'booking', 'salon', 'kuaför', 'spa', 'güzellik', 'tur', 'etkinlik']],
  ['egitim', ['eğitim', 'education', 'kurs', 'course', 'akademi', 'academy', 'okul', 'school', 'koçluk', 'koc', 'üniversite', 'dershane', 'sınav', 'öğrenci']],
  ['gayrimenkul', ['gayrimenkul', 'real estate', 'emlak', 'konut', 'satılık', 'kiralık', 'proje', 'arsa', 'inşaat', 'müteahhit', 'property']],
]

/** The set of valid template keys (for membership checks / validation). */
export const KNOWN_TEMPLATE_KEYS = TEMPLATE_SIGNALS.map(([k]) => k)

/**
 * The DEFAULT template when no category/instruction matches a sector. 'kurumsal'
 * is the safest generic business shape (home/about/services/contact) and its pool
 * covers the broadest set of components. Never null → the library path always has
 * a sector seed (the blueprint validator can still emit null when truly generic).
 */
export const DEFAULT_TEMPLATE_KEY = 'kurumsal'

/**
 * Infer the industry-template key from a site's signals. Case/locale-insensitive
 * substring match against the joined (category + siteType-hint + instruction)
 * haystack. Returns a known key, or DEFAULT_TEMPLATE_KEY when nothing matches
 * (so the library path always has a sensible sector seed).
 *
 * @param {{ category?: string|null, siteType?: string|null, instruction?: string|null }} signals
 * @returns {string} a key in KNOWN_TEMPLATE_KEYS
 */
export function inferIndustryTemplateKey(signals) {
  const s = signals && typeof signals === 'object' ? signals : {}
  const category = typeof s.category === 'string' ? s.category : ''
  const instruction = typeof s.instruction === 'string' ? s.instruction : ''
  // A 'landing' site type biases towards the conversion-first landing template,
  // but only when nothing more specific matches (handled by scanning order below).
  const siteTypeHint = s.siteType === 'landing' ? 'hizmet landing tek sayfa' : ''
  const hay = `${category} ${instruction} ${siteTypeHint}`.toLowerCase()

  for (const [key, words] of TEMPLATE_SIGNALS) {
    for (const w of words) {
      if (hay.includes(w)) return key
    }
  }
  return DEFAULT_TEMPLATE_KEY
}

// ---------------------------------------------------------------------------
// Seed derivation — a deterministic per-site, per-generation seed so:
//   - two DIFFERENT sites differ (id is part of the seed), and
//   - a re-generation of the SAME site can VARY (version count is part of it).
// Pure string → the composition engine hashes it. No Date/Math.random.
// ---------------------------------------------------------------------------

/**
 * @param {string} websiteId   the site id (distinguishes sites)
 * @param {number} versionCount how many versions already exist (regenerations vary)
 * @returns {string} a stable seed string
 */
export function deriveSiteSeed(websiteId, versionCount) {
  const id = typeof websiteId === 'string' && websiteId ? websiteId : 'site'
  const v = Number.isFinite(versionCount) ? Math.max(0, Math.floor(versionCount)) : 0
  return `${id}::v${v}`
}

// ---------------------------------------------------------------------------
// Body assembly — compose a blueprint page's blocks into the page <body> inner
// HTML via the (injected) renderComponent. Navbar(s) (header) lead, footer trails,
// and the middle (content) blocks are wrapped in a single <main> landmark so the
// page is semantically well-formed (mirrors the LIB9 composed-page shape that the
// gate is proven to accept). Unknown keys render '' (skipped) — the blueprint
// validator already guarantees real keys, so this is belt-and-braces.
//
// @param {{ blocks: Array<{id:string,componentKey:string,content:object}> }} composedPage
// @param {import('./types').DesignSystem} ds
// @param {(key:string, content:object, ds:object, opts:object)=>string} renderComponent
// @param {{ mobileMenuAnim?: 'left'|'right'|'top' }} [opts]
// @returns {string} the page <body> inner HTML (header … <main>…</main> … footer)
// ---------------------------------------------------------------------------
export function renderComposedPageBody(composedPage, ds, renderComponent, opts) {
  const blocks = composedPage && Array.isArray(composedPage.blocks) ? composedPage.blocks : []
  const mobileMenuAnim = opts && opts.mobileMenuAnim ? opts.mobileMenuAnim : 'left'

  const header = []
  const main = []
  const footer = []

  for (const block of blocks) {
    if (!block || typeof block.componentKey !== 'string') continue
    const html = renderComponent(
      block.componentKey,
      block.content && typeof block.content === 'object' ? block.content : {},
      ds,
      { id: block.id, mobileMenuAnim },
    )
    if (typeof html !== 'string' || !html) continue

    // Route the block to the correct landmark bucket by its top-level tag so the
    // <main> wraps exactly the content sections (header/nav lead, footer trails).
    if (/^<(?:header|nav)\b/i.test(html)) header.push(html)
    else if (/^<footer\b/i.test(html)) footer.push(html)
    else main.push(html)
  }

  const mainHtml = main.length ? `<main>${main.join('')}</main>` : ''
  return `${header.join('')}${mainHtml}${footer.join('')}`
}

/**
 * Compose + render an ENTIRE blueprint into per-page body HTML. Pure given a
 * renderComponent. Returns one entry per blueprint page, IN ORDER, each carrying
 * the page's slug/pageRole/orderIndex/locale + the assembled body html (PRE image
 * resolution + PRE gate — the caller resolves images, sanitizes, and gates).
 *
 * @param {import('./types').SiteBlueprint} blueprint  a VALID blueprint
 * @param {import('./types').DesignSystem}  ds
 * @param {string|number}                   seed
 * @param {(key:string, content:object, ds:object, opts:object)=>string} renderComponent
 * @param {{ mobileMenuAnim?: 'left'|'right'|'top', defaultLocale?: string }} [opts]
 * @returns {Array<{ locale:string, slug:string, pageRole:string, orderIndex:number, html:string }>}
 */
export function renderBlueprintToPages(blueprint, ds, seed, renderComponent, opts) {
  const composed = composeBlueprint(blueprint, ds, seed)
  const pages = composed && Array.isArray(composed.pages) ? composed.pages : []
  const defaultLocale = (opts && opts.defaultLocale) || 'tr'

  return pages.map((page, idx) => ({
    locale: page.locale || defaultLocale,
    slug: page.slug || (idx === 0 ? 'home' : `page-${idx}`),
    pageRole: page.pageRole || (idx === 0 ? 'home' : 'custom'),
    orderIndex: typeof page.orderIndex === 'number' ? page.orderIndex : idx,
    html: renderComposedPageBody(page, ds, renderComponent, opts),
  }))
}
