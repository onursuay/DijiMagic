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
      { name: 'links', type: 'list', required: false, label: 'Menü bağlantıları' },
      { name: 'ctaLabel', type: 'text', required: false, label: 'CTA etiketi' },
      { name: 'ctaHref', type: 'href', required: false, label: 'CTA bağlantısı' },
    ],
    promptHint:
      'A SABİT (fixed, quality-guaranteed) sticky header. Background MUST stay OPAQUE (bg-[var(--surface)]) — never transparent, so the logo + menu remain readable over any section. Desktop nav links sit on ONE line (whitespace-nowrap, never wrap); the hamburger is the mobile escape hatch. Mobile menu uses the runtime contract (data-yoai-nav-toggle + an OPAQUE data-yoai-mobile-nav panel with a close X). One confident accent CTA on the right — not a row of equal-weight buttons.',
    deterministicRender: renderNavbarStandard,
  },

  'footer.standard': {
    key: 'footer.standard',
    category: 'navigation',
    blockTag: 'footer',
    contentFields: [
      { name: 'brandName', type: 'text', required: true, label: 'Marka adı' },
      { name: 'tagline', type: 'text', required: false, label: 'Kısa açıklama' },
      { name: 'links', type: 'list', required: false, label: 'Alt menü bağlantıları' },
      { name: 'madeWithLabel', type: 'text', required: false, label: 'Üretim işareti' },
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

  'services.grid': {
    key: 'services.grid',
    category: 'content',
    blockTag: 'section',
    contentFields: [
      { name: 'heading', type: 'text', required: true, label: 'Başlık' },
      { name: 'subheading', type: 'text', required: false, label: 'Alt başlık' },
      { name: 'items', type: 'list', required: true, label: 'Hizmet kartları' },
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
      { name: 'items', type: 'list', required: true, label: 'Soru-cevap çiftleri' },
    ],
    promptHint:
      'An accordion FAQ using the EXISTING data-yoai-toggle runtime hook: each question is a <button data-yoai-toggle="<answerId>"> and each answer is a panel with that id that starts `hidden` (the runtime toggles it + sets aria-expanded). Concise, honest answers; hairline-bordered rows on the surface.',
    deterministicRender: renderFaqAccordion,
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
