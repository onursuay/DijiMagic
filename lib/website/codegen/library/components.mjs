/**
 * lib/website/codegen/library/components.mjs
 *
 * THE COMPONENT LIBRARY — the "design vocabulary" foundation (Bölüm 4 of the
 * master plan, kilitlenmiş HİBRİT kararı). Pure ESM so it is importable by BOTH:
 *   - the TS layer (htmlGenerate / blockMap / index.ts) via a STATIC literal path
 *     ('./library/components.mjs') — the Turbopack .ts↔.mjs pairing rule, mirroring
 *     renderGate.ts ↔ renderGate.mjs and assembleDocument.ts ↔ .mjs.
 *   - scripts/verify-website-codegen.mjs (unit assertions, no live API).
 *
 * WHAT THIS IS (and is NOT):
 *   The library is the design vocabulary + the DETERMINISTIC FALLBACK renderer.
 *   It does NOT replace the free-form HTML engine (htmlGenerateShared.mjs) — both
 *   live side-by-side (HİBRİT). Each component produces an HTML STRING that flows
 *   through the EXISTING pipeline UNCHANGED: sanitizeSiteHtml → renderGate →
 *   assembleDocument. These are NOT React components.
 *
 * CONTRACT every deterministicRender MUST honour (verified in the `library`
 * section of scripts/verify-website-codegen.mjs):
 *   1. Top-level element carries data-yoai-block="<key>" + data-yoai-id="<id>"
 *      (id from opts.id, sequential — matches blockMap.mjs's data-yoai-id contract).
 *   2. COLOR ONLY via the var-token classes from htmlGenerateShared's DESIGN_VAR_SPEC
 *      (bg-[var(--surface)], text-[var(--ink)], [var(--accent)], …). NO raw hex,
 *      NO default Tailwind palette (bg-blue-600, text-gray-700, …).
 *   3. Images via {{IMG:short english query}} placeholders (never invented URLs).
 *   4. NO <script>, NO inline on* handlers, NO <iframe>, NO forms EXCEPT the
 *      contact form (the EXISTING data-yoai-form contract from #3).
 *   5. The output passes sanitizeSiteHtml BYTE-CLEAN (no structural stripping) and
 *      contributes to a gate-passing page (single <h1> only on the hero; landmarks
 *      come from navbar=<header>, hero/content=<section>, footer=<footer>).
 *
 * ComponentDef shape (plain descriptor — NO Zod, per the build contract; the master
 * plan §4.5 sketches a Zod contentSchema, but this foundation deliberately uses a
 * dependency-FREE plain `contentFields` descriptor so the .mjs stays importable by
 * the verify script + the engine with zero new deps. A Zod adapter can wrap this
 * later if richer runtime validation is wanted — the field names are the contract):
 *
 *   ComponentDef = {
 *     key,             // 'navbar.standard' → data-yoai-block value
 *     category,        // 'navigation' | 'hero' | 'content' | 'form' | 'cta'
 *     blockTag,        // 'header' | 'section' | 'footer' | 'nav'  (semantic landmark)
 *     contentFields,   // [{ name, type, required, label }]  (type ∈ text|richtext|image|href|list)
 *     promptHint,      // anti-generic composition directive for the AI prompt layer
 *     deterministicRender(content, ds, opts) → HTML string  (fallback + canonical render)
 *     requiresTier?,   // 'extra_credit' | 'pro' | undefined   (Bölüm 5.6)
 *   }
 */

/** @typedef {import('../types').DesignSystem} DesignSystem */

// ---------------------------------------------------------------------------
// Tiny HTML toolkit (dependency-free). Keeps every renderer terse + safe.
// ---------------------------------------------------------------------------

/** HTML-escape text content (&, <, >, ", '). */
export function esc(value) {
  const s = value == null ? '' : String(value)
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Resolve { id } from opts → the data-yoai-id value. Falls back to 'b1' so a
 * renderer never emits an empty id (which would break blockMap extraction).
 */
function blockId(opts) {
  const id = opts && typeof opts.id === 'string' ? opts.id.trim() : ''
  return id || 'b1'
}

/**
 * The two attributes EVERY block's top-level element must carry:
 * data-yoai-block="<key>" data-yoai-id="<id>". Returned as a ready-to-inline
 * string (already escaped where needed).
 */
function blockAttrs(key, opts) {
  return `data-yoai-block="${esc(key)}" data-yoai-id="${esc(blockId(opts))}"`
}

/**
 * The mobile-menu slide direction. Read from opts.mobileMenuAnim first (wizard
 * choice threaded through CodegenContext), else ds.mobileMenuAnim, else 'left'
 * — EXACTLY the same coercion as buildHtmlSystemPrompt in htmlGenerateShared.mjs.
 */
function mobileAnim(ds, opts) {
  const raw =
    (opts && opts.mobileMenuAnim) ||
    (ds && ds.mobileMenuAnim) ||
    'left'
  return raw === 'right' || raw === 'top' ? raw : 'left'
}

/** First non-empty string among the args (used for graceful content defaults). */
function firstText(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/** Coerce a content value to an array (list fields). */
function asList(v) {
  return Array.isArray(v) ? v : []
}

/**
 * Build a single {{IMG:query}} placeholder. The query is normalised to a short
 * single-line ascii-ish string; resolveImagePlaceholders (htmlGenerateShared)
 * swaps it for a real URL post-render.
 */
function img(query) {
  const q = firstText(query, 'abstract brand texture').replace(/[{}|]/g, ' ').replace(/\s+/g, ' ').trim()
  return `{{IMG:${q}}}`
}

/**
 * A hairline-bordered, var-token icon chip used across hero / services / cta.
 * Decorative inline SVG (allowed by the sanitizer's SVG subset).
 */
function checkIcon() {
  return (
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 6 9 17l-5-5"/></svg>'
  )
}

// ---------------------------------------------------------------------------
// Quality-critical: navbar.standard — the SABİT (fixed, test-guaranteed) header.
//
// HARD RULES (master plan + build contract):
//   - OPAQUE background: bg-[var(--surface)] (NEVER transparent — logo/menu must
//     stay readable on scroll). Optional backdrop-blur is layered ON TOP of the
//     opaque fill, not instead of it.
//   - Desktop nav on ONE line: whitespace-nowrap + flex flex-nowrap → links never
//     wrap to a 2nd line. The hamburger is the mobile escape hatch.
//   - Mobile hamburger uses the EXISTING runtime contract (yoai-site-runtime.js):
//       button data-yoai-nav-toggle="mobilenav" aria-controls="mobilenav"
//              aria-expanded="false" aria-label="…"
//       panel  <nav id="mobilenav" data-yoai-mobile-nav data-yoai-mobile-anim="…">
//     The runtime starts it CLOSED, toggles it, closes on link-click / Escape, and
//     drives the slide via inline styles (Tailwind-proof). The panel is OPAQUE
//     (bg-[var(--surface)]) and carries a CLOSE (X) control.
// ---------------------------------------------------------------------------

/**
 * @param {{ brandName?: string, logoQuery?: string, links?: {label:string,href:string}[],
 *           ctaLabel?: string, ctaHref?: string }} content
 * @param {DesignSystem} ds
 * @param {{ id?: string, mobileMenuAnim?: 'left'|'right'|'top' }} [opts]
 * @returns {string}
 */
function renderNavbarStandard(content, ds, opts) {
  const c = content || {}
  const brand = esc(firstText(c.brandName, 'YoAi'))
  const links = asList(c.links).filter((l) => l && l.label)
  const anim = mobileAnim(ds, opts)
  const ctaLabel = firstText(c.ctaLabel)
  const ctaHref = firstText(c.ctaHref, '#contact')

  // One-line desktop links — flex-nowrap + whitespace-nowrap guarantee no wrap.
  const desktopLinks = links
    .map(
      (l) =>
        `<a data-yoai-smooth href="${esc(firstText(l.href, '#'))}" class="whitespace-nowrap text-[var(--ink)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors">${esc(l.label)}</a>`,
    )
    .join('')

  const mobileLinks = links
    .map(
      (l) =>
        `<a data-yoai-smooth href="${esc(firstText(l.href, '#'))}" class="block py-2 text-lg text-[var(--ink)] hover:text-[var(--accent)] transition-colors">${esc(l.label)}</a>`,
    )
    .join('')

  const ctaDesktop = ctaLabel
    ? `<a href="${esc(ctaHref)}" class="hidden md:inline-flex whitespace-nowrap items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[var(--on-accent)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-[transform,box-shadow]">${esc(ctaLabel)}</a>`
    : ''
  const ctaMobile = ctaLabel
    ? `<a href="${esc(ctaHref)}" class="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[var(--on-accent)] shadow-[var(--shadow-sm)]">${esc(ctaLabel)}</a>`
    : ''

  const logo = c.logoQuery
    ? `<img src="${img(c.logoQuery)}" alt="${brand}" width="120" height="32" loading="eager" class="h-8 w-auto">`
    : `<span class="text-xl font-[family-name:var(--font-heading)] tracking-tight text-[var(--ink)]">${brand}</span>`

  // OPAQUE header (bg-[var(--surface)]) + sticky + hairline bottom border.
  return [
    `<header ${blockAttrs('navbar.standard', opts)} class="sticky top-0 z-50 w-full bg-[var(--surface)] border-b border-[var(--border)] backdrop-blur-sm">`,
    `<nav class="mx-auto flex max-w-7xl flex-nowrap items-center justify-between gap-6 px-6 md:px-8 py-3">`,
    `<a href="#top" class="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]">${logo}</a>`,
    // Desktop links — single row, never wrap.
    `<div class="hidden md:flex flex-nowrap items-center gap-6 whitespace-nowrap">${desktopLinks}${ctaDesktop}</div>`,
    // Hamburger (mobile) — EXACT runtime contract.
    `<button data-yoai-nav-toggle="mobilenav" aria-controls="mobilenav" aria-expanded="false" aria-label="${esc(firstText(c.menuLabel, 'Menü'))}" class="md:hidden inline-flex items-center justify-center rounded-[var(--radius-sm)] p-2 text-[var(--ink)] hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors">`,
    `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
    `</button>`,
    `</nav>`,
    // OPAQUE mobile panel — runtime owns visibility/slide; close control included.
    `<nav id="mobilenav" data-yoai-mobile-nav data-yoai-mobile-anim="${esc(anim)}" aria-label="${esc(firstText(c.menuLabel, 'Menü'))}" class="fixed top-0 ${anim === 'right' ? 'right-0' : 'left-0'} z-[60] flex h-full w-72 max-w-[80vw] flex-col bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]">`,
    `<div class="flex items-center justify-between">`,
    `<span class="text-lg font-[family-name:var(--font-heading)] text-[var(--ink)]">${brand}</span>`,
    `<button data-yoai-nav-toggle="mobilenav" aria-controls="mobilenav" aria-label="${esc(firstText(c.closeLabel, 'Kapat'))}" class="inline-flex items-center justify-center rounded-[var(--radius-sm)] p-2 text-[var(--ink)] hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors">`,
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
    `</button>`,
    `</div>`,
    `<div class="mt-6 flex flex-col gap-1">${mobileLinks}${ctaMobile}</div>`,
    `</nav>`,
    `</header>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// Shared navbar pieces (DRY across every navbar variant). Each navbar variant
// reuses the SAME hard rules as navbar.standard:
//   - OPAQUE header bg-[var(--surface)] (never transparent, esp. mobile),
//   - desktop nav single-line (whitespace-nowrap + flex-nowrap),
//   - mobile uses the runtime contract (data-yoai-nav-toggle / data-yoai-mobile-nav
//     / data-yoai-mobile-anim + an OPAQUE panel + a close-X control).
// ---------------------------------------------------------------------------

/** A logo lockup — image when logoQuery is set, else the brand wordmark. */
function navLogo(c, brand) {
  return c.logoQuery
    ? `<img src="${img(c.logoQuery)}" alt="${brand}" width="120" height="32" loading="eager" class="h-8 w-auto">`
    : `<span class="text-xl font-[family-name:var(--font-heading)] tracking-tight text-[var(--ink)]">${brand}</span>`
}

/** Desktop links row markup (single line — caller wraps in flex-nowrap). */
function navDesktopLinks(links) {
  return links
    .map(
      (l) =>
        `<a data-yoai-smooth href="${esc(firstText(l.href, '#'))}" class="whitespace-nowrap text-[var(--ink)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors">${esc(l.label)}</a>`,
    )
    .join('')
}

/** The OPAQUE mobile slide panel + its close-X (runtime contract). */
function navMobilePanel(brand, links, c, anim, ctaLabel, ctaHref) {
  const mobileLinks = links
    .map(
      (l) =>
        `<a data-yoai-smooth href="${esc(firstText(l.href, '#'))}" class="block py-2 text-lg text-[var(--ink)] hover:text-[var(--accent)] transition-colors">${esc(l.label)}</a>`,
    )
    .join('')
  const ctaMobile = ctaLabel
    ? `<a href="${esc(ctaHref)}" class="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[var(--on-accent)] shadow-[var(--shadow-sm)]">${esc(ctaLabel)}</a>`
    : ''
  return [
    `<nav id="mobilenav" data-yoai-mobile-nav data-yoai-mobile-anim="${esc(anim)}" aria-label="${esc(firstText(c.menuLabel, 'Menü'))}" class="fixed top-0 ${anim === 'right' ? 'right-0' : 'left-0'} z-[60] flex h-full w-72 max-w-[80vw] flex-col bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]">`,
    `<div class="flex items-center justify-between">`,
    `<span class="text-lg font-[family-name:var(--font-heading)] text-[var(--ink)]">${brand}</span>`,
    `<button data-yoai-nav-toggle="mobilenav" aria-controls="mobilenav" aria-label="${esc(firstText(c.closeLabel, 'Kapat'))}" class="inline-flex items-center justify-center rounded-[var(--radius-sm)] p-2 text-[var(--ink)] hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors">`,
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
    `</button>`,
    `</div>`,
    `<div class="mt-6 flex flex-col gap-1">${mobileLinks}${ctaMobile}</div>`,
    `</nav>`,
  ].join('')
}

/** The mobile hamburger button (runtime contract). */
function navHamburger(c) {
  return [
    `<button data-yoai-nav-toggle="mobilenav" aria-controls="mobilenav" aria-expanded="false" aria-label="${esc(firstText(c.menuLabel, 'Menü'))}" class="md:hidden inline-flex items-center justify-center rounded-[var(--radius-sm)] p-2 text-[var(--ink)] hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors">`,
    `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
    `</button>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// navbar.centered-logo — symmetric layout: links left, centered wordmark/logo,
// CTA right. SAME hard rules (OPAQUE, nowrap desktop, runtime mobile contract).
// ---------------------------------------------------------------------------

function renderNavbarCenteredLogo(content, ds, opts) {
  const c = content || {}
  const brand = esc(firstText(c.brandName, 'YoAi'))
  const links = asList(c.links).filter((l) => l && l.label)
  const anim = mobileAnim(ds, opts)
  const ctaLabel = firstText(c.ctaLabel)
  const ctaHref = firstText(c.ctaHref, '#contact')
  // Split links left/right of the centered logo for symmetry.
  const mid = Math.ceil(links.length / 2)
  const leftLinks = navDesktopLinks(links.slice(0, mid))
  const rightLinks = navDesktopLinks(links.slice(mid))
  const ctaDesktop = ctaLabel
    ? `<a href="${esc(ctaHref)}" class="hidden md:inline-flex whitespace-nowrap items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[var(--on-accent)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-[transform,box-shadow]">${esc(ctaLabel)}</a>`
    : ''

  return [
    `<header ${blockAttrs('navbar.centered-logo', opts)} class="sticky top-0 z-50 w-full bg-[var(--surface)] border-b border-[var(--border)] backdrop-blur-sm">`,
    `<nav class="mx-auto flex max-w-7xl flex-nowrap items-center justify-between gap-6 px-6 md:px-8 py-3">`,
    // Left links (desktop).
    `<div class="hidden md:flex flex-1 flex-nowrap items-center gap-6 whitespace-nowrap">${leftLinks}</div>`,
    // Centered logo lockup.
    `<a href="#top" class="flex shrink-0 items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)] md:absolute md:left-1/2 md:-translate-x-1/2">${navLogo(c, brand)}</a>`,
    // Right links + CTA (desktop).
    `<div class="hidden md:flex flex-1 flex-nowrap items-center justify-end gap-6 whitespace-nowrap">${rightLinks}${ctaDesktop}</div>`,
    // Hamburger (mobile).
    navHamburger(c),
    `</nav>`,
    navMobilePanel(brand, links, c, anim, ctaLabel, ctaHref),
    `</header>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// navbar.left-logo-right-cta — logo hard-left, links pushed right next to a
// single confident CTA. SAME hard rules (OPAQUE, nowrap desktop, runtime mobile).
// ---------------------------------------------------------------------------

function renderNavbarLeftLogoRightCta(content, ds, opts) {
  const c = content || {}
  const brand = esc(firstText(c.brandName, 'YoAi'))
  const links = asList(c.links).filter((l) => l && l.label)
  const anim = mobileAnim(ds, opts)
  const ctaLabel = firstText(c.ctaLabel)
  const ctaHref = firstText(c.ctaHref, '#contact')
  const desktopLinks = navDesktopLinks(links)
  const ctaDesktop = ctaLabel
    ? `<a href="${esc(ctaHref)}" class="hidden md:inline-flex whitespace-nowrap items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-5 py-2 text-[var(--on-accent)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-[transform,box-shadow]">${esc(ctaLabel)}</a>`
    : ''

  return [
    `<header ${blockAttrs('navbar.left-logo-right-cta', opts)} class="sticky top-0 z-50 w-full bg-[var(--surface)] border-b border-[var(--border)] backdrop-blur-sm">`,
    `<nav class="mx-auto flex max-w-7xl flex-nowrap items-center gap-6 px-6 md:px-8 py-3">`,
    // Logo hard-left.
    `<a href="#top" class="mr-auto flex shrink-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]">${navLogo(c, brand)}</a>`,
    // Links pushed right (desktop, single line).
    `<div class="hidden md:flex flex-nowrap items-center gap-6 whitespace-nowrap">${desktopLinks}</div>`,
    // The confident CTA, last on the right.
    ctaDesktop,
    // Hamburger (mobile).
    navHamburger(c),
    `</nav>`,
    navMobilePanel(brand, links, c, anim, ctaLabel, ctaHref),
    `</header>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// Quality-critical: footer.standard — current year injected SERVER-SIDE.
//   - new Date().getFullYear() runs inside deterministicRender (Next server) →
//     never an AI-hardcoded/stale year.
//   - footer nav wraps gracefully (flex-wrap + gap, never overflows).
//   - keeps the "YoAi ile üretildi" footer mark.
// ---------------------------------------------------------------------------

/**
 * @param {{ brandName?: string, tagline?: string, links?: {label:string,href:string}[],
 *           madeWithLabel?: string }} content
 * @param {DesignSystem} ds
 * @param {{ id?: string }} [opts]
 * @returns {string}
 */
function renderFooterStandard(content, ds, opts) {
  const c = content || {}
  const brand = esc(firstText(c.brandName, 'YoAi'))
  const tagline = firstText(c.tagline)
  // SERVER-SIDE current year — computed at render time, never hardcoded.
  const year = new Date().getFullYear()
  const links = asList(c.links).filter((l) => l && l.label)
  const made = esc(firstText(c.madeWithLabel, 'YoAi ile üretildi'))

  const navLinks = links
    .map(
      (l) =>
        `<a data-yoai-smooth href="${esc(firstText(l.href, '#'))}" class="text-[var(--muted)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors">${esc(l.label)}</a>`,
    )
    .join('')

  return [
    `<footer ${blockAttrs('footer.standard', opts)} class="w-full bg-[var(--surface)] border-t border-[var(--border)]">`,
    `<div class="mx-auto max-w-7xl px-6 md:px-8 py-10">`,
    `<div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">`,
    `<div class="max-w-sm">`,
    `<span class="text-lg font-[family-name:var(--font-heading)] tracking-tight text-[var(--ink)]">${brand}</span>`,
    tagline ? `<p class="mt-2 text-sm leading-relaxed text-[var(--muted)]">${esc(tagline)}</p>` : '',
    `</div>`,
    // Footer nav — flex-wrap + gap → wraps gracefully, never overflows.
    navLinks
      ? `<nav class="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="${esc(firstText(c.navLabel, 'Alt menü'))}">${navLinks}</nav>`
      : '',
    `</div>`,
    `<div class="mt-8 flex flex-col gap-2 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">`,
    `<p class="text-sm text-[var(--muted)]">&copy; ${esc(String(year))} ${brand}</p>`,
    `<p class="text-sm text-[var(--muted)]">${made}</p>`,
    `</div>`,
    `</div>`,
    `</footer>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// Quality-critical: contact-form.standard — the EXISTING data-yoai-form contract.
//   - <form data-yoai-form> with name/email/phone/message inputs + honeypot +
//     data-yoai-form-success (the #3 contract). The SERVER injects the action
//     POST-sanitize → this renderer sets NO action.
// ---------------------------------------------------------------------------

/**
 * @param {{ heading?: string, subheading?: string, namePlaceholder?: string,
 *           emailPlaceholder?: string, phonePlaceholder?: string,
 *           messagePlaceholder?: string, submitLabel?: string,
 *           successText?: string, errorText?: string }} content
 * @param {DesignSystem} ds
 * @param {{ id?: string }} [opts]
 * @returns {string}
 */
function renderContactFormStandard(content, ds, opts) {
  const c = content || {}
  const heading = esc(firstText(c.heading, 'İletişime geçin'))
  const sub = firstText(c.subheading)
  const inputCls =
    'w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-[box-shadow]'

  return [
    `<section ${blockAttrs('contact-form.standard', opts)} id="contact" class="w-full bg-[var(--surface)] py-10 md:py-12">`,
    `<div class="mx-auto max-w-3xl px-6 md:px-8">`,
    `<h2 class="text-3xl font-[family-name:var(--font-heading)] tracking-tight text-[var(--ink)]">${heading}</h2>`,
    sub ? `<p class="mt-3 text-[var(--muted)] leading-relaxed">${esc(sub)}</p>` : '',
    // NO action / method — the runtime + server own submission (data-yoai-form).
    `<form data-yoai-form class="mt-8 grid gap-5">`,
    `<div class="grid gap-2">`,
    `<label for="cf-name" class="text-sm font-medium text-[var(--ink)]">${esc(firstText(c.nameLabel, 'Ad Soyad'))}</label>`,
    `<input id="cf-name" type="text" name="name" required autocomplete="name" placeholder="${esc(firstText(c.namePlaceholder, 'Adınız Soyadınız'))}" class="${inputCls}">`,
    `</div>`,
    `<div class="grid gap-2">`,
    `<label for="cf-email" class="text-sm font-medium text-[var(--ink)]">${esc(firstText(c.emailLabel, 'E-posta'))}</label>`,
    `<input id="cf-email" type="email" name="email" required autocomplete="email" placeholder="${esc(firstText(c.emailPlaceholder, 'ornek@eposta.com'))}" class="${inputCls}">`,
    `</div>`,
    `<div class="grid gap-2">`,
    `<label for="cf-phone" class="text-sm font-medium text-[var(--ink)]">${esc(firstText(c.phoneLabel, 'Telefon'))}</label>`,
    `<input id="cf-phone" type="tel" name="phone" autocomplete="tel" placeholder="${esc(firstText(c.phonePlaceholder, '05xx xxx xx xx'))}" class="${inputCls}">`,
    `</div>`,
    `<div class="grid gap-2">`,
    `<label for="cf-message" class="text-sm font-medium text-[var(--ink)]">${esc(firstText(c.messageLabel, 'Mesaj'))}</label>`,
    `<textarea id="cf-message" name="message" required rows="4" placeholder="${esc(firstText(c.messagePlaceholder, 'Mesajınız…'))}" class="${inputCls}"></textarea>`,
    `</div>`,
    // HONEYPOT — type=text, human-invisible, no label (the #3 anti-spam contract).
    `<input type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" data-yoai-honeypot class="absolute -left-[9999px] h-0 w-0 opacity-0 pointer-events-none">`,
    `<button type="submit" class="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-6 py-3 text-[var(--on-accent)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-[transform,box-shadow]">${esc(firstText(c.submitLabel, 'Gönder'))}</button>`,
    `<div data-yoai-form-success hidden class="rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-4 py-3 text-[var(--ink)]">${esc(firstText(c.successText, 'Teşekkürler, mesajınız iletildi.'))}</div>`,
    `<div data-yoai-form-error hidden class="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-3 text-[var(--ink)]">${esc(firstText(c.errorText, 'Bir şeyler ters gitti, lütfen tekrar deneyin.'))}</div>`,
    `</form>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// Proof set: hero.minimal — centered editorial hero (the page's single <h1>).
// ---------------------------------------------------------------------------

function renderHeroMinimal(content, ds, opts) {
  const c = content || {}
  const heading = esc(firstText(c.heading, 'Markanız için modern bir web sitesi'))
  const sub = firstText(c.subheading)
  const ctaLabel = firstText(c.ctaLabel, 'Başlayın')
  const ctaHref = firstText(c.ctaHref, '#contact')
  const secondaryLabel = firstText(c.secondaryLabel)
  const secondaryHref = firstText(c.secondaryHref, '#services')
  const eyebrow = firstText(c.eyebrow)

  return [
    `<section ${blockAttrs('hero.minimal', opts)} id="top" data-yoai-reveal class="relative w-full overflow-hidden bg-[var(--surface)] py-16 md:py-20">`,
    `<div class="pointer-events-none absolute inset-0" style="background-image:var(--gradient-glow)" aria-hidden="true"></div>`,
    `<div class="relative mx-auto max-w-3xl px-6 md:px-8 text-center">`,
    eyebrow
      ? `<span class="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium text-[var(--accent)]">${esc(eyebrow)}</span>`
      : '',
    `<h1 class="mt-5 text-4xl md:text-6xl font-[family-name:var(--font-heading)] tracking-[-0.03em] text-[var(--ink)]">${heading}</h1>`,
    sub ? `<p class="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[var(--muted)]">${esc(sub)}</p>` : '',
    `<div class="mt-8 flex flex-wrap items-center justify-center gap-4">`,
    `<a href="${esc(ctaHref)}" class="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-6 py-3 text-[var(--on-accent)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-[transform,box-shadow]">${esc(ctaLabel)}</a>`,
    secondaryLabel
      ? `<a data-yoai-smooth href="${esc(secondaryHref)}" class="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] px-6 py-3 text-[var(--ink)] hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors">${esc(secondaryLabel)}</a>`
      : '',
    `</div>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// Proof set: hero.split-image — asymmetric copy + image editorial split.
// ---------------------------------------------------------------------------

function renderHeroSplitImage(content, ds, opts) {
  const c = content || {}
  const heading = esc(firstText(c.heading, 'Markanızı öne çıkaran tasarım'))
  const sub = firstText(c.subheading)
  const ctaLabel = firstText(c.ctaLabel, 'Teklif alın')
  const ctaHref = firstText(c.ctaHref, '#contact')
  const imageQuery = firstText(c.imageQuery, 'modern brand studio workspace warm light')
  const imageAlt = esc(firstText(c.imageAlt, heading))

  return [
    `<section ${blockAttrs('hero.split-image', opts)} id="top" data-yoai-reveal class="relative w-full overflow-hidden bg-[var(--surface)] py-14 md:py-20">`,
    `<div class="mx-auto grid max-w-7xl items-center gap-10 px-6 md:px-8 md:grid-cols-2">`,
    `<div>`,
    `<h1 class="text-4xl md:text-5xl font-[family-name:var(--font-heading)] tracking-[-0.03em] text-[var(--ink)]">${heading}</h1>`,
    sub ? `<p class="mt-5 max-w-md text-lg leading-relaxed text-[var(--muted)]">${esc(sub)}</p>` : '',
    `<a href="${esc(ctaHref)}" class="mt-8 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-6 py-3 text-[var(--on-accent)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-[transform,box-shadow]">${esc(ctaLabel)}</a>`,
    `</div>`,
    `<div class="relative">`,
    `<img src="${img(imageQuery)}" alt="${imageAlt}" width="800" height="600" loading="lazy" class="w-full rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]">`,
    `<div class="pointer-events-none absolute inset-0 rounded-[var(--radius-lg)]" style="background-image:var(--gradient-overlay)" aria-hidden="true"></div>`,
    `</div>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// hero.full-background — full-bleed image with a legibility gradient overlay.
// A single <h1> + CTA sit ON the image; --gradient-overlay keeps text readable.
// ---------------------------------------------------------------------------

function renderHeroFullBackground(content, ds, opts) {
  const c = content || {}
  const heading = esc(firstText(c.heading, 'Markanızı öne çıkaran dijital deneyim'))
  const sub = firstText(c.subheading)
  const ctaLabel = firstText(c.ctaLabel, 'Başlayın')
  const ctaHref = firstText(c.ctaHref, '#contact')
  const eyebrow = firstText(c.eyebrow)
  const imageQuery = firstText(c.imageQuery, 'modern architecture dramatic light wide')
  const imageAlt = esc(firstText(c.imageAlt, heading))

  return [
    `<section ${blockAttrs('hero.full-background', opts)} id="top" data-yoai-reveal class="relative w-full overflow-hidden">`,
    // Full-bleed image layer.
    `<img src="${img(imageQuery)}" alt="${imageAlt}" width="1600" height="900" loading="eager" class="absolute inset-0 h-full w-full object-cover">`,
    // Legibility overlay — gradient var keeps copy readable over any photo.
    `<div class="pointer-events-none absolute inset-0" style="background-image:var(--gradient-overlay)" aria-hidden="true"></div>`,
    `<div class="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col justify-end px-6 md:px-8 py-16 md:py-24">`,
    `<div class="max-w-2xl">`,
    eyebrow
      ? `<span class="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--surface)]/90 px-3 py-1 text-sm font-medium text-[var(--accent)]">${esc(eyebrow)}</span>`
      : '',
    `<h1 class="mt-5 text-4xl md:text-6xl font-[family-name:var(--font-heading)] tracking-[-0.03em] text-[var(--on-accent)] drop-shadow-[var(--shadow-lg)]">${heading}</h1>`,
    sub ? `<p class="mt-5 max-w-xl text-lg leading-relaxed text-[var(--on-accent)] opacity-90">${esc(sub)}</p>` : '',
    `<a href="${esc(ctaHref)}" class="mt-8 inline-flex w-fit items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-6 py-3 text-[var(--on-accent)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--surface)] transition-[transform,box-shadow]">${esc(ctaLabel)}</a>`,
    `</div>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// hero.service-business — trust-forward hero for local/service businesses:
// headline + a quick proof-point list (check chips) + a strong CTA pair.
// ---------------------------------------------------------------------------

function renderHeroServiceBusiness(content, ds, opts) {
  const c = content || {}
  const heading = esc(firstText(c.heading, 'Bölgenizin güvenilir hizmet ortağı'))
  const sub = firstText(c.subheading)
  const ctaLabel = firstText(c.ctaLabel, 'Ücretsiz teklif alın')
  const ctaHref = firstText(c.ctaHref, '#contact')
  const phoneLabel = firstText(c.phoneLabel)
  const phoneHref = firstText(c.phoneHref, '#contact')
  const points = asList(c.points).filter((p) => typeof p === 'string' && p.trim())
  const fallbackPoints = points.length ? points : ['Hızlı dönüş', 'Şeffaf fiyatlandırma', 'Garantili işçilik']
  const imageQuery = firstText(c.imageQuery, 'friendly service professional at work daylight')
  const imageAlt = esc(firstText(c.imageAlt, heading))

  const proofs = fallbackPoints
    .map(
      (p) =>
        `<li class="flex items-center gap-2 text-[var(--ink)]"><span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">${checkIcon()}</span><span>${esc(p)}</span></li>`,
    )
    .join('')

  return [
    `<section ${blockAttrs('hero.service-business', opts)} id="top" data-yoai-reveal class="relative w-full overflow-hidden bg-[var(--surface)] py-14 md:py-20">`,
    `<div class="pointer-events-none absolute inset-0" style="background-image:var(--gradient-glow)" aria-hidden="true"></div>`,
    `<div class="relative mx-auto grid max-w-7xl items-center gap-10 px-6 md:px-8 md:grid-cols-2">`,
    `<div>`,
    `<h1 class="text-4xl md:text-5xl font-[family-name:var(--font-heading)] tracking-[-0.03em] text-[var(--ink)]">${heading}</h1>`,
    sub ? `<p class="mt-5 max-w-md text-lg leading-relaxed text-[var(--muted)]">${esc(sub)}</p>` : '',
    `<ul class="mt-6 grid gap-2">${proofs}</ul>`,
    `<div class="mt-8 flex flex-wrap items-center gap-4">`,
    `<a href="${esc(ctaHref)}" class="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-6 py-3 text-[var(--on-accent)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-[transform,box-shadow]">${esc(ctaLabel)}</a>`,
    phoneLabel
      ? `<a href="${esc(phoneHref)}" class="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] px-6 py-3 text-[var(--ink)] hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors">${esc(phoneLabel)}</a>`
      : '',
    `</div>`,
    `</div>`,
    `<div class="relative">`,
    `<img src="${img(imageQuery)}" alt="${imageAlt}" width="800" height="640" loading="lazy" class="w-full rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]">`,
    `</div>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// hero.corporate — structured, confident B2B hero: eyebrow + headline + lede,
// dual CTA, and a row of quiet metric stats. No photo — typographic authority.
// ---------------------------------------------------------------------------

function renderHeroCorporate(content, ds, opts) {
  const c = content || {}
  const eyebrow = firstText(c.eyebrow)
  const heading = esc(firstText(c.heading, 'Kurumunuzu ileriye taşıyan çözümler'))
  const sub = firstText(c.subheading)
  const ctaLabel = firstText(c.ctaLabel, 'Görüşme planlayın')
  const ctaHref = firstText(c.ctaHref, '#contact')
  const secondaryLabel = firstText(c.secondaryLabel)
  const secondaryHref = firstText(c.secondaryHref, '#services')
  const stats = asList(c.stats).filter((s) => s && (s.value || s.label))

  const statRow = stats.length
    ? `<dl class="mt-12 grid max-w-2xl grid-cols-2 gap-8 border-t border-[var(--border)] pt-8 sm:grid-cols-3">${stats
        .map(
          (s) =>
            `<div><dt class="text-3xl font-[family-name:var(--font-heading)] text-[var(--ink)]">${esc(firstText(s.value, ''))}</dt><dd class="mt-1 text-sm text-[var(--muted)]">${esc(firstText(s.label, ''))}</dd></div>`,
        )
        .join('')}</dl>`
    : ''

  return [
    `<section ${blockAttrs('hero.corporate', opts)} id="top" data-yoai-reveal class="relative w-full overflow-hidden bg-[var(--surface)] py-16 md:py-24">`,
    `<div class="pointer-events-none absolute inset-0" style="background-image:var(--gradient-glow)" aria-hidden="true"></div>`,
    `<div class="relative mx-auto max-w-7xl px-6 md:px-8">`,
    `<div class="max-w-3xl">`,
    eyebrow
      ? `<span class="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium text-[var(--accent)]">${esc(eyebrow)}</span>`
      : '',
    `<h1 class="mt-5 text-4xl md:text-6xl font-[family-name:var(--font-heading)] tracking-[-0.03em] text-[var(--ink)]">${heading}</h1>`,
    sub ? `<p class="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">${esc(sub)}</p>` : '',
    `<div class="mt-8 flex flex-wrap items-center gap-4">`,
    `<a href="${esc(ctaHref)}" class="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-6 py-3 text-[var(--on-accent)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-[transform,box-shadow]">${esc(ctaLabel)}</a>`,
    secondaryLabel
      ? `<a data-yoai-smooth href="${esc(secondaryHref)}" class="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] px-6 py-3 text-[var(--ink)] hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-colors">${esc(secondaryLabel)}</a>`
      : '',
    `</div>`,
    `</div>`,
    statRow,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// hero.luxury — refined, high-contrast editorial hero on the brand gradient:
// generous space, letterspaced eyebrow, oversized serif-leaning headline, one
// quiet outline CTA. Premium restraint (text in --on-accent over the gradient).
// ---------------------------------------------------------------------------

function renderHeroLuxury(content, ds, opts) {
  const c = content || {}
  const eyebrow = firstText(c.eyebrow)
  const heading = esc(firstText(c.heading, 'Zarafetin yeni tanımı'))
  const sub = firstText(c.subheading)
  const ctaLabel = firstText(c.ctaLabel, 'Koleksiyonu keşfedin')
  const ctaHref = firstText(c.ctaHref, '#contact')

  return [
    `<section ${blockAttrs('hero.luxury', opts)} id="top" data-yoai-reveal class="relative w-full overflow-hidden py-24 md:py-32" style="background-image:var(--gradient-brand)">`,
    `<div class="relative mx-auto max-w-4xl px-6 md:px-8 text-center">`,
    eyebrow
      ? `<span class="inline-block text-sm font-medium uppercase tracking-[0.3em] text-[var(--on-accent)] opacity-80">${esc(eyebrow)}</span>`
      : '',
    `<h1 class="mt-6 text-5xl md:text-7xl font-[family-name:var(--font-heading)] tracking-[-0.02em] leading-[1.05] text-[var(--on-accent)]">${heading}</h1>`,
    sub ? `<p class="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--on-accent)] opacity-85">${esc(sub)}</p>` : '',
    `<a href="${esc(ctaHref)}" class="mt-10 inline-flex items-center rounded-[var(--radius-md)] border border-[var(--on-accent)] px-8 py-3 text-[var(--on-accent)] hover:bg-[var(--surface)] hover:text-[var(--ink)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--surface)] transition-[transform,colors,box-shadow]">${esc(ctaLabel)}</a>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// Proof set: services.grid — value-prop / services card grid.
// ---------------------------------------------------------------------------

function renderServicesGrid(content, ds, opts) {
  const c = content || {}
  const heading = esc(firstText(c.heading, 'Hizmetlerimiz'))
  const sub = firstText(c.subheading)
  const items = asList(c.items).filter((it) => it && (it.title || it.body))
  const fallback = items.length
    ? items
    : [
        { title: 'Strateji', body: 'Markanıza özel net bir yol haritası.' },
        { title: 'Tasarım', body: 'Dikkat çeken, markaya uygun arayüzler.' },
        { title: 'Geliştirme', body: 'Hızlı, güvenli ve ölçeklenebilir altyapı.' },
      ]

  const cards = fallback
    .map((it, i) => {
      const idx = Math.min(i, 10)
      return [
        `<article data-yoai-reveal data-yoai-delay="${idx * 120}" class="group rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] transition-[transform,box-shadow]">`,
        `<span class="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">${checkIcon()}</span>`,
        `<h3 class="mt-4 text-xl font-[family-name:var(--font-heading)] text-[var(--ink)]">${esc(firstText(it.title, 'Hizmet'))}</h3>`,
        it.body ? `<p class="mt-2 text-[var(--muted)] leading-relaxed">${esc(it.body)}</p>` : '',
        `</article>`,
      ].join('')
    })
    .join('')

  return [
    `<section ${blockAttrs('services.grid', opts)} id="services" class="w-full bg-[var(--surface)] py-10 md:py-12">`,
    `<div class="mx-auto max-w-7xl px-6 md:px-8">`,
    `<div class="max-w-2xl">`,
    `<h2 class="text-3xl font-[family-name:var(--font-heading)] tracking-tight text-[var(--ink)]">${heading}</h2>`,
    sub ? `<p class="mt-3 text-[var(--muted)] leading-relaxed">${esc(sub)}</p>` : '',
    `</div>`,
    `<div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// Proof set: cta.band — full-width accent CTA band (gradient brand background).
// ---------------------------------------------------------------------------

function renderCtaBand(content, ds, opts) {
  const c = content || {}
  const heading = esc(firstText(c.heading, 'Projenize bugün başlayalım'))
  const sub = firstText(c.subheading)
  const ctaLabel = firstText(c.ctaLabel, 'İletişime geçin')
  const ctaHref = firstText(c.ctaHref, '#contact')

  return [
    `<section ${blockAttrs('cta.band', opts)} data-yoai-reveal class="w-full py-12 md:py-16" style="background-image:var(--gradient-brand)">`,
    `<div class="mx-auto max-w-4xl px-6 md:px-8 text-center">`,
    `<h2 class="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight text-[var(--on-accent)]">${heading}</h2>`,
    sub ? `<p class="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[var(--on-accent)] opacity-90">${esc(sub)}</p>` : '',
    `<a href="${esc(ctaHref)}" class="mt-8 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--surface)] px-6 py-3 text-[var(--ink)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--surface)] transition-[transform,box-shadow]">${esc(ctaLabel)}</a>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// Proof set: faq.accordion — uses the EXISTING data-yoai-toggle runtime hook.
//   The runtime toggles `is-open` + the `hidden` attribute on the target id and
//   sets aria-expanded on the trigger. Each answer panel starts with `hidden`
//   (closed); the trigger carries data-yoai-toggle="<answerId>".
// ---------------------------------------------------------------------------

function renderFaqAccordion(content, ds, opts) {
  const c = content || {}
  const heading = esc(firstText(c.heading, 'Sıkça sorulan sorular'))
  const id = blockId(opts)
  const items = asList(c.items).filter((it) => it && it.question)
  const fallback = items.length
    ? items
    : [
        { question: 'Süreç nasıl ilerliyor?', answer: 'Kısa bir keşif görüşmesiyle başlıyor, ardından tasarım ve geliştirme adımlarını sizinle birlikte yürütüyoruz.' },
        { question: 'Teslim süresi nedir?', answer: 'Kapsamına göre değişmekle birlikte tipik bir proje birkaç hafta içinde tamamlanır.' },
      ]

  const rows = fallback
    .map((it, i) => {
      const ansId = `${id}-faq-${i}`
      return [
        `<div class="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">`,
        `<button data-yoai-toggle="${esc(ansId)}" aria-controls="${esc(ansId)}" aria-expanded="false" class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[var(--ink)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-md)] transition-colors">`,
        `<span class="font-medium">${esc(it.question)}</span>`,
        `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`,
        `</button>`,
        `<div id="${esc(ansId)}" hidden class="px-5 pb-5 text-[var(--muted)] leading-relaxed">${esc(firstText(it.answer, ''))}</div>`,
        `</div>`,
      ].join('')
    })
    .join('')

  return [
    `<section ${blockAttrs('faq.accordion', opts)} id="faq" class="w-full bg-[var(--surface)] py-10 md:py-12">`,
    `<div class="mx-auto max-w-3xl px-6 md:px-8">`,
    `<h2 class="text-3xl font-[family-name:var(--font-heading)] tracking-tight text-[var(--ink)]">${heading}</h2>`,
    `<div class="mt-8 grid gap-3">${rows}</div>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// Content variant: testimonials.cards — a quote-card grid (social proof).
//   Each card: a blockquote, an attribution (name + role), optional avatar.
//   Staggered reveals; surface cards with a hairline + subtle shadow.
// ---------------------------------------------------------------------------

function renderTestimonialsCards(content, ds, opts) {
  const c = content || {}
  const heading = esc(firstText(c.heading, 'Müşterilerimiz ne diyor'))
  const sub = firstText(c.subheading)
  const items = asList(c.items).filter((it) => it && (it.quote || it.name))
  const fallback = items.length
    ? items
    : [
        { quote: 'Sürecin her adımında yanımızdaydılar; sonuç beklentimizin ötesindeydi.', name: 'Elif Y.', role: 'Pazarlama Müdürü' },
        { quote: 'Markamızı tam anlamıyla yansıtan, hızlı ve şık bir site teslim ettiler.', name: 'Murat K.', role: 'Kurucu' },
        { quote: 'İletişim çok netti, teslim tarihine sadık kaldılar.', name: 'Selin A.', role: 'Operasyon' },
      ]

  const cards = fallback
    .map((it, i) => {
      const idx = Math.min(i, 10)
      const avatar = it.avatarQuery
        ? `<img src="${img(it.avatarQuery)}" alt="${esc(firstText(it.name, ''))}" width="44" height="44" loading="lazy" class="h-11 w-11 rounded-full object-cover">`
        : `<span class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] font-[family-name:var(--font-heading)] text-[var(--accent)]" aria-hidden="true">${esc(firstText(it.name, '·').trim().charAt(0))}</span>`
      const role = firstText(it.role)
      return [
        `<figure data-yoai-reveal data-yoai-delay="${idx * 120}" class="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] transition-[transform,box-shadow]">`,
        `<blockquote class="flex-1 text-[var(--ink)] leading-relaxed">${esc(firstText(it.quote, ''))}</blockquote>`,
        `<figcaption class="mt-5 flex items-center gap-3">${avatar}<span class="leading-tight"><span class="block font-medium text-[var(--ink)]">${esc(firstText(it.name, ''))}</span>${role ? `<span class="block text-sm text-[var(--muted)]">${esc(role)}</span>` : ''}</span></figcaption>`,
        `</figure>`,
      ].join('')
    })
    .join('')

  return [
    `<section ${blockAttrs('testimonials.cards', opts)} id="testimonials" class="w-full bg-[var(--surface)] py-10 md:py-12">`,
    `<div class="mx-auto max-w-7xl px-6 md:px-8">`,
    `<div class="max-w-2xl">`,
    `<h2 class="text-3xl font-[family-name:var(--font-heading)] tracking-tight text-[var(--ink)]">${heading}</h2>`,
    sub ? `<p class="mt-3 text-[var(--muted)] leading-relaxed">${esc(sub)}</p>` : '',
    `</div>`,
    `<div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// Content variant: gallery.grid — a responsive image gallery (work/portfolio).
//   Each tile: a rounded image with a subtle overlay + optional caption. All
//   images via {{IMG:}} placeholders; staggered reveals.
// ---------------------------------------------------------------------------

function renderGalleryGrid(content, ds, opts) {
  const c = content || {}
  const heading = esc(firstText(c.heading, 'Çalışmalarımız'))
  const sub = firstText(c.subheading)
  const items = asList(c.items).filter((it) => it && (it.imageQuery || it.caption))
  const fallback = items.length
    ? items
    : [
        { imageQuery: 'brand identity flat lay studio', caption: 'Marka kimliği' },
        { imageQuery: 'responsive website mockup laptop', caption: 'Web tasarımı' },
        { imageQuery: 'product photography minimal', caption: 'Ürün çekimi' },
        { imageQuery: 'social media content grid', caption: 'Sosyal medya' },
        { imageQuery: 'editorial print layout', caption: 'Basılı tasarım' },
        { imageQuery: 'packaging design mockup', caption: 'Ambalaj' },
      ]

  const tiles = fallback
    .map((it, i) => {
      const idx = Math.min(i, 10)
      const caption = firstText(it.caption)
      return [
        `<figure data-yoai-reveal data-yoai-delay="${idx * 90}" class="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow-sm)]">`,
        `<img src="${img(it.imageQuery)}" alt="${esc(caption || heading)}" width="640" height="480" loading="lazy" class="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105">`,
        `<div class="pointer-events-none absolute inset-0" style="background-image:var(--gradient-overlay)" aria-hidden="true"></div>`,
        caption
          ? `<figcaption class="absolute bottom-0 left-0 right-0 p-4 text-[var(--on-accent)]">${esc(caption)}</figcaption>`
          : '',
        `</figure>`,
      ].join('')
    })
    .join('')

  return [
    `<section ${blockAttrs('gallery.grid', opts)} id="gallery" class="w-full bg-[var(--surface)] py-10 md:py-12">`,
    `<div class="mx-auto max-w-7xl px-6 md:px-8">`,
    `<div class="max-w-2xl">`,
    `<h2 class="text-3xl font-[family-name:var(--font-heading)] tracking-tight text-[var(--ink)]">${heading}</h2>`,
    sub ? `<p class="mt-3 text-[var(--muted)] leading-relaxed">${esc(sub)}</p>` : '',
    `</div>`,
    `<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${tiles}</div>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// Content variant: pricing-table.tiers — a 2–3 tier pricing grid. One tier may
//   be `featured` (raised, accent-ringed). Each tier: name, price, period,
//   a feature list, and a CTA. var-token only; sanitize/gate-safe.
// ---------------------------------------------------------------------------

function renderPricingTableTiers(content, ds, opts) {
  const c = content || {}
  const heading = esc(firstText(c.heading, 'Şeffaf fiyatlandırma'))
  const sub = firstText(c.subheading)
  const tiers = asList(c.tiers).filter((t) => t && (t.name || t.price))
  const fallback = tiers.length
    ? tiers
    : [
        { name: 'Başlangıç', price: '₺2.500', period: 'aylık', features: ['Tek sayfa site', 'Mobil uyumlu', 'Temel SEO'], ctaLabel: 'Başlayın', ctaHref: '#contact' },
        { name: 'Profesyonel', price: '₺4.900', period: 'aylık', features: ['Çok sayfalı site', 'İçerik yönetimi', 'Gelişmiş SEO', 'Aylık raporlama'], ctaLabel: 'Teklif alın', ctaHref: '#contact', featured: true, badge: 'En popüler' },
        { name: 'Kurumsal', price: 'Özel', period: 'projeye göre', features: ['Özel geliştirme', 'Entegrasyonlar', 'Öncelikli destek'], ctaLabel: 'İletişime geçin', ctaHref: '#contact' },
      ]

  const cards = fallback
    .map((t, i) => {
      const idx = Math.min(i, 10)
      const featured = !!t.featured
      const features = asList(t.features).filter((f) => typeof f === 'string' && f.trim())
      const featureList = features
        .map(
          (f) =>
            `<li class="flex items-start gap-2 text-[var(--ink)]"><span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">${checkIcon()}</span><span>${esc(f)}</span></li>`,
        )
        .join('')
      const period = firstText(t.period)
      const badge = firstText(t.badge)
      const ctaLabel = firstText(t.ctaLabel, 'Seçin')
      const ctaHref = firstText(t.ctaHref, '#contact')
      const ctaCls = featured
        ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]'
        : 'border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--accent-soft)]'
      return [
        `<article data-yoai-reveal data-yoai-delay="${idx * 120}" class="flex h-full flex-col rounded-[var(--radius-lg)] border ${featured ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]' : 'border-[var(--border)]'} bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] transition-[transform,box-shadow]">`,
        `<div class="flex items-center justify-between gap-2"><h3 class="text-xl font-[family-name:var(--font-heading)] text-[var(--ink)]">${esc(firstText(t.name, 'Plan'))}</h3>${badge ? `<span class="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">${esc(badge)}</span>` : ''}</div>`,
        `<p class="mt-4 flex items-baseline gap-1"><span class="text-4xl font-[family-name:var(--font-heading)] tracking-tight text-[var(--ink)]">${esc(firstText(t.price, ''))}</span>${period ? `<span class="text-sm text-[var(--muted)]">/ ${esc(period)}</span>` : ''}</p>`,
        featureList ? `<ul class="mt-6 grid flex-1 gap-3">${featureList}</ul>` : '<div class="flex-1"></div>',
        `<a href="${esc(ctaHref)}" class="mt-8 inline-flex items-center justify-center rounded-[var(--radius-md)] px-6 py-3 ${ctaCls} active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-[transform,box-shadow,colors]">${esc(ctaLabel)}</a>`,
        `</article>`,
      ].join('')
    })
    .join('')

  return [
    `<section ${blockAttrs('pricing-table.tiers', opts)} id="pricing" class="w-full bg-[var(--surface)] py-10 md:py-12">`,
    `<div class="mx-auto max-w-7xl px-6 md:px-8">`,
    `<div class="max-w-2xl">`,
    `<h2 class="text-3xl font-[family-name:var(--font-heading)] tracking-tight text-[var(--ink)]">${heading}</h2>`,
    sub ? `<p class="mt-3 text-[var(--muted)] leading-relaxed">${esc(sub)}</p>` : '',
    `</div>`,
    `<div class="mt-8 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>`,
    `</div>`,
    `</section>`,
  ].join('')
}

// ---------------------------------------------------------------------------
// THE REGISTRY — keyed by ComponentDef.key. listComponents / getComponent /
// renderComponent (index.ts) read from here. Each render fn is pure given (content,
// ds, opts) — EXCEPT footer.standard, which reads new Date().getFullYear() so the
// copyright year is always current (server-side, never hardcoded).
// ---------------------------------------------------------------------------

/** @type {Record<string, import('./index').ComponentDef>} */
export const COMPONENTS = {
  'navbar.standard': {
    key: 'navbar.standard',
    category: 'navigation',
    blockTag: 'header',
    contentFields: [
      { name: 'brandName', type: 'text', required: true, label: 'Marka adı' },
      { name: 'logoQuery', type: 'image', required: false, label: 'Logo görsel sorgusu' },
      {
        name: 'links',
        type: 'list',
        required: false,
        label: 'Menü bağlantıları',
        item: [
          { name: 'label', type: 'text', label: 'Bağlantı metni' },
          { name: 'href', type: 'href', label: 'Bağlantı adresi' },
        ],
      },
      { name: 'ctaLabel', type: 'text', required: false, label: 'CTA etiketi' },
      { name: 'ctaHref', type: 'href', required: false, label: 'CTA bağlantısı' },
      { name: 'menuLabel', type: 'text', required: false, label: 'Menü aç etiketi (erişilebilirlik)' },
      { name: 'closeLabel', type: 'text', required: false, label: 'Menü kapat etiketi (erişilebilirlik)' },
    ],
    promptHint:
      'A SABİT (fixed, quality-guaranteed) sticky header. Background MUST stay OPAQUE (bg-[var(--surface)]) — never transparent, so the logo + menu remain readable over any section. Desktop nav links sit on ONE line (whitespace-nowrap, never wrap); the hamburger is the mobile escape hatch. Mobile menu uses the runtime contract (data-yoai-nav-toggle + an OPAQUE data-yoai-mobile-nav panel with a close X). One confident accent CTA on the right — not a row of equal-weight buttons.',
    deterministicRender: renderNavbarStandard,
  },

  'navbar.centered-logo': {
    key: 'navbar.centered-logo',
    category: 'navigation',
    blockTag: 'header',
    contentFields: [
      { name: 'brandName', type: 'text', required: true, label: 'Marka adı' },
      { name: 'logoQuery', type: 'image', required: false, label: 'Logo görsel sorgusu' },
      {
        name: 'links',
        type: 'list',
        required: false,
        label: 'Menü bağlantıları',
        item: [
          { name: 'label', type: 'text', label: 'Bağlantı metni' },
          { name: 'href', type: 'href', label: 'Bağlantı adresi' },
        ],
      },
      { name: 'ctaLabel', type: 'text', required: false, label: 'CTA etiketi' },
      { name: 'ctaHref', type: 'href', required: false, label: 'CTA bağlantısı' },
      { name: 'menuLabel', type: 'text', required: false, label: 'Menü aç etiketi (erişilebilirlik)' },
      { name: 'closeLabel', type: 'text', required: false, label: 'Menü kapat etiketi (erişilebilirlik)' },
    ],
    promptHint:
      'A symmetric header: a few links on the LEFT, the centered logo/wordmark, and the remaining links + ONE accent CTA on the RIGHT. SAME hard rules as navbar.standard — OPAQUE bg-[var(--surface)] (never transparent), desktop links on ONE line (whitespace-nowrap, never wrap), and the runtime mobile contract (data-yoai-nav-toggle + an OPAQUE data-yoai-mobile-nav panel with a close X). Balanced, editorial feel.',
    deterministicRender: renderNavbarCenteredLogo,
  },

  'navbar.left-logo-right-cta': {
    key: 'navbar.left-logo-right-cta',
    category: 'navigation',
    blockTag: 'header',
    contentFields: [
      { name: 'brandName', type: 'text', required: true, label: 'Marka adı' },
      { name: 'logoQuery', type: 'image', required: false, label: 'Logo görsel sorgusu' },
      {
        name: 'links',
        type: 'list',
        required: false,
        label: 'Menü bağlantıları',
        item: [
          { name: 'label', type: 'text', label: 'Bağlantı metni' },
          { name: 'href', type: 'href', label: 'Bağlantı adresi' },
        ],
      },
      { name: 'ctaLabel', type: 'text', required: false, label: 'CTA etiketi' },
      { name: 'ctaHref', type: 'href', required: false, label: 'CTA bağlantısı' },
      { name: 'menuLabel', type: 'text', required: false, label: 'Menü aç etiketi (erişilebilirlik)' },
      { name: 'closeLabel', type: 'text', required: false, label: 'Menü kapat etiketi (erişilebilirlik)' },
    ],
    promptHint:
      'A classic SaaS header: the logo hard-LEFT, the nav links pushed to the RIGHT next to ONE confident accent CTA (the last element). SAME hard rules as navbar.standard — OPAQUE bg-[var(--surface)] (never transparent), desktop links on ONE line (whitespace-nowrap, never wrap), the runtime mobile contract (data-yoai-nav-toggle + OPAQUE data-yoai-mobile-nav panel with a close X). Not a row of equal-weight buttons — one CTA only.',
    deterministicRender: renderNavbarLeftLogoRightCta,
  },

  'footer.standard': {
    key: 'footer.standard',
    category: 'navigation',
    blockTag: 'footer',
    contentFields: [
      { name: 'brandName', type: 'text', required: true, label: 'Marka adı' },
      { name: 'tagline', type: 'text', required: false, label: 'Kısa açıklama' },
      {
        name: 'links',
        type: 'list',
        required: false,
        label: 'Alt menü bağlantıları',
        item: [
          { name: 'label', type: 'text', label: 'Bağlantı metni' },
          { name: 'href', type: 'href', label: 'Bağlantı adresi' },
        ],
      },
      { name: 'madeWithLabel', type: 'text', required: false, label: 'Üretim işareti' },
      { name: 'navLabel', type: 'text', required: false, label: 'Alt menü etiketi (erişilebilirlik)' },
    ],
    promptHint:
      'A calm, structured footer. The copyright year is injected SERVER-SIDE at render — never write a literal year. Footer nav wraps gracefully (flex-wrap + gap) and never overflows. Keep the "YoAi ile üretildi" mark. Muted text on the surface background; one hairline divider for rhythm.',
    deterministicRender: renderFooterStandard,
  },

  'contact-form.standard': {
    key: 'contact-form.standard',
    category: 'form',
    blockTag: 'section',
    contentFields: [
      { name: 'heading', type: 'text', required: true, label: 'Başlık' },
      { name: 'subheading', type: 'text', required: false, label: 'Alt başlık' },
      { name: 'nameLabel', type: 'text', required: false, label: 'Ad alanı etiketi' },
      { name: 'namePlaceholder', type: 'text', required: false, label: 'Ad alanı ipucu' },
      { name: 'emailLabel', type: 'text', required: false, label: 'E-posta alanı etiketi' },
      { name: 'emailPlaceholder', type: 'text', required: false, label: 'E-posta alanı ipucu' },
      { name: 'phoneLabel', type: 'text', required: false, label: 'Telefon alanı etiketi' },
      { name: 'phonePlaceholder', type: 'text', required: false, label: 'Telefon alanı ipucu' },
      { name: 'messageLabel', type: 'text', required: false, label: 'Mesaj alanı etiketi' },
      { name: 'messagePlaceholder', type: 'text', required: false, label: 'Mesaj alanı ipucu' },
      { name: 'submitLabel', type: 'text', required: false, label: 'Gönder etiketi' },
      { name: 'successText', type: 'text', required: false, label: 'Başarı mesajı' },
      { name: 'errorText', type: 'text', required: false, label: 'Hata mesajı' },
    ],
    promptHint:
      'A polished, on-brand contact form using the EXISTING data-yoai-form contract: name (text) + email (email) + phone (tel, optional) + message (textarea), a hidden honeypot input[name="company"], a submit <button>, and the data-yoai-form-success / data-yoai-form-error elements. Set NO action — the server injects it post-sanitize. Style inputs with the var() tokens (border, radius, focus ring), never bare browser fields.',
    deterministicRender: renderContactFormStandard,
  },

  'hero.minimal': {
    key: 'hero.minimal',
    category: 'hero',
    blockTag: 'section',
    contentFields: [
      { name: 'eyebrow', type: 'text', required: false, label: 'Üst etiket' },
      { name: 'heading', type: 'text', required: true, label: 'Başlık (tek H1)' },
      { name: 'subheading', type: 'richtext', required: false, label: 'Alt başlık' },
      { name: 'ctaLabel', type: 'text', required: false, label: 'Birincil CTA' },
      { name: 'ctaHref', type: 'href', required: false, label: 'Birincil CTA bağlantısı' },
      { name: 'secondaryLabel', type: 'text', required: false, label: 'İkincil CTA' },
      { name: 'secondaryHref', type: 'href', required: false, label: 'İkincil CTA bağlantısı' },
    ],
    promptHint:
      'A centered, editorial hero carrying the page\'s SINGLE <h1>. Oversized tight-tracked display headline, one airy supporting paragraph, one dominant accent CTA (+ optional quiet secondary). Layer the --gradient-glow behind it as a soft decorative depth layer — never a flat fill.',
    deterministicRender: renderHeroMinimal,
  },

  'hero.split-image': {
    key: 'hero.split-image',
    category: 'hero',
    blockTag: 'section',
    contentFields: [
      { name: 'heading', type: 'text', required: true, label: 'Başlık (tek H1)' },
      { name: 'subheading', type: 'richtext', required: false, label: 'Alt başlık' },
      { name: 'ctaLabel', type: 'text', required: false, label: 'CTA etiketi' },
      { name: 'ctaHref', type: 'href', required: false, label: 'CTA bağlantısı' },
      { name: 'imageQuery', type: 'image', required: true, label: 'Görsel sorgusu' },
      { name: 'imageAlt', type: 'text', required: false, label: 'Görsel alt metni' },
    ],
    promptHint:
      'An asymmetric copy-left / image-right hero (the page\'s SINGLE <h1>). The image is treated richly: rounded-[var(--radius-lg)], a layered shadow, and a --gradient-overlay sibling for editorial legibility/mood. Confident headline + one accent CTA — never a centered stack.',
    deterministicRender: renderHeroSplitImage,
  },

  'hero.full-background': {
    key: 'hero.full-background',
    category: 'hero',
    blockTag: 'section',
    contentFields: [
      { name: 'eyebrow', type: 'text', required: false, label: 'Üst etiket' },
      { name: 'heading', type: 'text', required: true, label: 'Başlık (tek H1)' },
      { name: 'subheading', type: 'richtext', required: false, label: 'Alt başlık' },
      { name: 'ctaLabel', type: 'text', required: false, label: 'CTA etiketi' },
      { name: 'ctaHref', type: 'href', required: false, label: 'CTA bağlantısı' },
      { name: 'imageQuery', type: 'image', required: true, label: 'Arka plan görsel sorgusu' },
      { name: 'imageAlt', type: 'text', required: false, label: 'Görsel alt metni' },
    ],
    promptHint:
      'A full-bleed, immersive hero: a large background image fills the section, with the --gradient-overlay layered ON TOP for text legibility. The SINGLE <h1> + a short lede + one accent CTA sit on the image (text in --on-accent). Copy anchors to the lower-left for an editorial, cinematic feel. Image via {{IMG:}} — never an invented URL.',
    deterministicRender: renderHeroFullBackground,
  },

  'hero.service-business': {
    key: 'hero.service-business',
    category: 'hero',
    blockTag: 'section',
    contentFields: [
      { name: 'heading', type: 'text', required: true, label: 'Başlık (tek H1)' },
      { name: 'subheading', type: 'richtext', required: false, label: 'Alt başlık' },
      { name: 'points', type: 'list', required: false, label: 'Güven maddeleri (metin listesi)' },
      { name: 'ctaLabel', type: 'text', required: false, label: 'Birincil CTA' },
      { name: 'ctaHref', type: 'href', required: false, label: 'Birincil CTA bağlantısı' },
      { name: 'phoneLabel', type: 'text', required: false, label: 'Telefon/ikincil CTA' },
      { name: 'phoneHref', type: 'href', required: false, label: 'Telefon/ikincil CTA bağlantısı' },
      { name: 'imageQuery', type: 'image', required: true, label: 'Görsel sorgusu' },
      { name: 'imageAlt', type: 'text', required: false, label: 'Görsel alt metni' },
    ],
    promptHint:
      'A trust-forward hero for a local / service business (the page\'s SINGLE <h1>). Copy-left with 3 short proof-point chips (check icons), a strong primary CTA + a quiet phone/secondary action; a warm, human image on the right (rounded, shadowed). Reassuring, concrete benefits — no vague filler. Image via {{IMG:}}.',
    deterministicRender: renderHeroServiceBusiness,
  },

  'hero.corporate': {
    key: 'hero.corporate',
    category: 'hero',
    blockTag: 'section',
    contentFields: [
      { name: 'eyebrow', type: 'text', required: false, label: 'Üst etiket' },
      { name: 'heading', type: 'text', required: true, label: 'Başlık (tek H1)' },
      { name: 'subheading', type: 'richtext', required: false, label: 'Alt başlık' },
      { name: 'ctaLabel', type: 'text', required: false, label: 'Birincil CTA' },
      { name: 'ctaHref', type: 'href', required: false, label: 'Birincil CTA bağlantısı' },
      { name: 'secondaryLabel', type: 'text', required: false, label: 'İkincil CTA' },
      { name: 'secondaryHref', type: 'href', required: false, label: 'İkincil CTA bağlantısı' },
      {
        name: 'stats',
        type: 'list',
        required: false,
        label: 'Metrikler',
        item: [
          { name: 'value', type: 'text', label: 'Değer' },
          { name: 'label', type: 'text', label: 'Etiket' },
        ],
      },
    ],
    promptHint:
      'A structured, authoritative B2B / corporate hero (the page\'s SINGLE <h1>). No photo — typographic confidence: eyebrow + oversized tight-tracked headline + a substantive lede, a dual CTA (solid primary + outline secondary), and a quiet metric stat row (value over label) divided by a hairline. Credible, measured tone.',
    deterministicRender: renderHeroCorporate,
  },

  'hero.luxury': {
    key: 'hero.luxury',
    category: 'hero',
    blockTag: 'section',
    contentFields: [
      { name: 'eyebrow', type: 'text', required: false, label: 'Üst etiket (boşluklu)' },
      { name: 'heading', type: 'text', required: true, label: 'Başlık (tek H1)' },
      { name: 'subheading', type: 'richtext', required: false, label: 'Alt başlık' },
      { name: 'ctaLabel', type: 'text', required: false, label: 'CTA etiketi' },
      { name: 'ctaHref', type: 'href', required: false, label: 'CTA bağlantısı' },
    ],
    promptHint:
      'A refined, premium hero on the --gradient-brand background (text in --on-accent). Generous vertical space, a letterspaced uppercase eyebrow, an oversized display headline (the SINGLE <h1>) with tight leading, one short evocative line, and a SINGLE quiet outline CTA that fills to --surface on hover. Restraint over clutter — luxury is space.',
    deterministicRender: renderHeroLuxury,
  },

  'services.grid': {
    key: 'services.grid',
    category: 'content',
    blockTag: 'section',
    contentFields: [
      { name: 'heading', type: 'text', required: true, label: 'Başlık' },
      { name: 'subheading', type: 'text', required: false, label: 'Alt başlık' },
      {
        name: 'items',
        type: 'list',
        required: true,
        label: 'Hizmet kartları',
        item: [
          { name: 'title', type: 'text', label: 'Kart başlığı' },
          { name: 'body', type: 'richtext', label: 'Kart açıklaması' },
        ],
      },
    ],
    promptHint:
      'A responsive value-prop / services card grid (1 → 2 → 3 columns). Each card: an accent-soft icon chip, an <h3>, a concrete benefit line (no empty filler). Cards form a surface system (raised, hover-lift with shadow-[var(--shadow-md)]); stagger reveals with data-yoai-delay.',
    deterministicRender: renderServicesGrid,
  },

  'cta.band': {
    key: 'cta.band',
    category: 'cta',
    blockTag: 'section',
    contentFields: [
      { name: 'heading', type: 'text', required: true, label: 'Başlık' },
      { name: 'subheading', type: 'text', required: false, label: 'Alt başlık' },
      { name: 'ctaLabel', type: 'text', required: false, label: 'CTA etiketi' },
      { name: 'ctaHref', type: 'href', required: false, label: 'CTA bağlantısı' },
    ],
    promptHint:
      'A full-width conversion band on the --gradient-brand background (text in --on-accent). One strong headline, a short supporting line, and a high-contrast surface-colored CTA button that pops against the brand gradient. This is the page\'s commit-to-action moment.',
    deterministicRender: renderCtaBand,
  },

  'faq.accordion': {
    key: 'faq.accordion',
    category: 'content',
    blockTag: 'section',
    contentFields: [
      { name: 'heading', type: 'text', required: true, label: 'Başlık' },
      {
        name: 'items',
        type: 'list',
        required: true,
        label: 'Soru-cevap çiftleri',
        item: [
          { name: 'question', type: 'text', label: 'Soru' },
          { name: 'answer', type: 'richtext', label: 'Cevap' },
        ],
      },
    ],
    promptHint:
      'An accordion FAQ using the EXISTING data-yoai-toggle runtime hook: each question is a <button data-yoai-toggle="<answerId>"> and each answer is a panel with that id that starts `hidden` (the runtime toggles it + sets aria-expanded). Concise, honest answers; hairline-bordered rows on the surface.',
    deterministicRender: renderFaqAccordion,
  },

  'testimonials.cards': {
    key: 'testimonials.cards',
    category: 'content',
    blockTag: 'section',
    contentFields: [
      { name: 'heading', type: 'text', required: true, label: 'Başlık' },
      { name: 'subheading', type: 'text', required: false, label: 'Alt başlık' },
      {
        name: 'items',
        type: 'list',
        required: true,
        label: 'Görüşler',
        item: [
          { name: 'quote', type: 'richtext', label: 'Görüş metni' },
          { name: 'name', type: 'text', label: 'İsim' },
          { name: 'role', type: 'text', label: 'Ünvan / rol' },
          { name: 'avatarQuery', type: 'image', label: 'Avatar görsel sorgusu' },
        ],
      },
    ],
    promptHint:
      'A social-proof grid of testimonial cards (1 → 2 → 3 columns). Each card is a <figure> with a real-sounding <blockquote> and an attribution (name + role); an optional avatar (image via {{IMG:}} or a tinted monogram fallback). Cards form a surface system (hairline border, subtle shadow, hover-lift); stagger reveals with data-yoai-delay. Honest, specific quotes — no generic praise.',
    deterministicRender: renderTestimonialsCards,
  },

  'gallery.grid': {
    key: 'gallery.grid',
    category: 'content',
    blockTag: 'section',
    contentFields: [
      { name: 'heading', type: 'text', required: true, label: 'Başlık' },
      { name: 'subheading', type: 'text', required: false, label: 'Alt başlık' },
      {
        name: 'items',
        type: 'list',
        required: true,
        label: 'Görseller',
        item: [
          { name: 'imageQuery', type: 'image', label: 'Görsel sorgusu' },
          { name: 'caption', type: 'text', label: 'Açıklama' },
        ],
      },
    ],
    promptHint:
      'A responsive image gallery / portfolio grid (1 → 2 → 3 columns). Each tile is a <figure> with a rounded {{IMG:}} image (4:3), a --gradient-overlay sibling for depth, and an optional caption overlaid at the bottom (text in --on-accent). Subtle zoom-on-hover; stagger reveals with data-yoai-delay. Every image via {{IMG:}} — never invented URLs.',
    deterministicRender: renderGalleryGrid,
  },

  'pricing-table.tiers': {
    key: 'pricing-table.tiers',
    category: 'content',
    blockTag: 'section',
    contentFields: [
      { name: 'heading', type: 'text', required: true, label: 'Başlık' },
      { name: 'subheading', type: 'text', required: false, label: 'Alt başlık' },
      {
        name: 'tiers',
        type: 'list',
        required: true,
        label: 'Fiyat planları',
        item: [
          { name: 'name', type: 'text', label: 'Plan adı' },
          { name: 'price', type: 'text', label: 'Fiyat' },
          { name: 'period', type: 'text', label: 'Dönem (ör. aylık)' },
          { name: 'features', type: 'list', label: 'Özellikler (metin listesi)' },
          { name: 'badge', type: 'text', label: 'Rozet (ör. En popüler)' },
          { name: 'featured', type: 'text', label: 'Öne çıkan plan (true ise vurgulu)' },
          { name: 'ctaLabel', type: 'text', label: 'CTA etiketi' },
          { name: 'ctaHref', type: 'href', label: 'CTA bağlantısı' },
        ],
      },
    ],
    promptHint:
      'A 2–3 tier pricing grid. Each tier card: name, big price + period, a feature list with check chips, and a CTA. ONE tier may be `featured` (accent ring + raised) with an optional badge ("En popüler"). var-token color only; cards equal-height in a surface system with hover-lift; stagger reveals. Transparent, concrete plans — no hidden-cost vibes.',
    deterministicRender: renderPricingTableTiers,
  },
}

// ---------------------------------------------------------------------------
// Pure helpers (re-exported by index.ts with types).
// ---------------------------------------------------------------------------

/** All registered component keys, in registry order. */
export function listComponentKeys() {
  return Object.keys(COMPONENTS)
}

/** Look up a ComponentDef by key (undefined if unknown). */
export function getComponent(key) {
  return COMPONENTS[key]
}

/**
 * Render a component to an HTML string. Unknown key → '' (caller falls back).
 * @param {string} key
 * @param {Record<string, unknown>} content
 * @param {DesignSystem} ds
 * @param {{ id?: string, mobileMenuAnim?: 'left'|'right'|'top' }} [opts]
 * @returns {string}
 */
export function renderComponent(key, content, ds, opts) {
  const def = COMPONENTS[key]
  if (!def || typeof def.deterministicRender !== 'function') return ''
  return def.deterministicRender(content || {}, ds || {}, opts || {})
}

/**
 * Filter the registry by category (e.g. 'hero', 'navigation'). Returns ComponentDefs.
 * @param {string} category
 * @returns {import('./index').ComponentDef[]}
 */
export function listComponents(category) {
  const all = Object.values(COMPONENTS)
  if (!category) return all
  return all.filter((d) => d.category === category)
}
