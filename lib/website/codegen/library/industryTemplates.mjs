/**
 * lib/website/codegen/library/industryTemplates.mjs
 *
 * INDUSTRY TEMPLATES — the sector-shaped seed for the blueprint generator
 * (Bölüm 4.3 of the master plan). Pure ESM so it is importable by BOTH the TS
 * blueprint generator/validator and scripts/verify-website-codegen.mjs (no TS
 * build, no live API), mirroring components.mjs / multipagePlanShared.mjs.
 *
 * WHAT A TEMPLATE IS (and is NOT):
 *   A template is a SKELETON + a POOL + token HINTS — NOT a fixed page of content.
 *     - defaultPages       : the recommended PageRole set (home first, contact present).
 *     - componentPool      : per PageRole, a POOL of EXISTING registry component keys
 *                            the composition engine picks a VARIED subset from
 *                            (seed-driven → two sites of the same industry differ →
 *                            anti-clone, Bölüm 5.3).
 *     - tokenSuggestions   : optional palette/font hints (NOT mandatory — the
 *                            DesignSystem stage still owns the real tokens).
 *     - bookingMode/commerceMode : declares the sector's transaction shape so the
 *                            generator knows to lean on reservation/ticket/commerce
 *                            framing (mock flows — Bölüm 4.6).
 *
 * HARD RULE — componentPool uses ONLY keys that EXIST in components.mjs TODAY.
 *   The composition engine validates every key against the real registry; an
 *   invented key would be dropped. For commerce/booking shapes not yet in the
 *   registry (product cards, ticket cards, cart) we use the CLOSEST available
 *   component (services.grid / gallery.grid / pricing-table.tiers) and mark the
 *   intent with a `// TODO: <component> when built (later batch)` note — never a
 *   fictional key. The 11 industries:
 *     otel · restoran · feribot-bilet · klinik · ajans · e-ticaret · kurumsal ·
 *     hizmet-landing · rezervasyon · egitim · gayrimenkul
 */

// The real registry keys available TODAY (kept in sync with components.mjs).
// Anything outside this set is an invented key and is rejected by the engine.
//   navbars : navbar.standard · navbar.centered-logo · navbar.left-logo-right-cta
//   footer  : footer.standard
//   heroes  : hero.minimal · hero.split-image · hero.full-background ·
//             hero.service-business · hero.corporate · hero.luxury
//   content : services.grid · faq.accordion · testimonials.cards · gallery.grid ·
//             pricing-table.tiers
//   cta     : cta.band
//   form    : contact-form.standard

// PageRole values mirror lib/website/types.ts (and multipagePlanShared.PAGE_ROLES).
// Templates author plans against THESE roles only.
//   home · about · services · products · contact · blog · faq · gallery · custom

const NAV_POOL = ['navbar.standard', 'navbar.centered-logo', 'navbar.left-logo-right-cta']
const FOOTER_POOL = ['footer.standard']
const CONTACT_POOL = ['contact-form.standard', 'faq.accordion']

/**
 * The 11 system industry templates, keyed by template key.
 * @type {Record<string, import('./industryTemplates').IndustryTemplate>}
 */
export const INDUSTRY_TEMPLATES = {
  // ── otel — accommodation / hotel: rich imagery, rooms, gallery, booking lean ──
  otel: {
    key: 'otel',
    defaultPages: ['home', 'services', 'gallery', 'contact'],
    componentPool: {
      // services pool doubles as the "rooms/room types" pool.
      // TODO: hotel-room-card / package-card when built (later batch) — for now
      // services.grid + gallery.grid + pricing-table.tiers express rooms/rates.
      home: ['navbar.standard', 'navbar.centered-logo', 'hero.full-background', 'hero.split-image', 'hero.luxury', 'services.grid', 'gallery.grid', 'testimonials.cards', 'pricing-table.tiers', 'cta.band', 'footer.standard'],
      services: ['navbar.standard', 'hero.split-image', 'services.grid', 'pricing-table.tiers', 'gallery.grid', 'cta.band', 'footer.standard'],
      gallery: ['navbar.standard', 'hero.minimal', 'gallery.grid', 'testimonials.cards', 'cta.band', 'footer.standard'],
      contact: ['navbar.standard', 'hero.minimal', 'contact-form.standard', 'faq.accordion', 'footer.standard'],
    },
    tokenSuggestions: {
      fonts: { headingHref: null, heading: '"Playfair Display", serif', body: 'Inter, sans-serif' },
    },
    bookingMode: 'reservation',
    commerceMode: 'none',
  },

  // ── restoran — restaurant/cafe: menu, gallery, atmosphere, reservation lean ──
  restoran: {
    key: 'restoran',
    defaultPages: ['home', 'services', 'gallery', 'contact'],
    componentPool: {
      // "services" expresses the MENU here; gallery the dishes/atmosphere.
      // TODO: menu-card / reservation-form when built (later batch).
      home: ['navbar.standard', 'navbar.centered-logo', 'hero.full-background', 'hero.split-image', 'services.grid', 'gallery.grid', 'testimonials.cards', 'cta.band', 'footer.standard'],
      services: ['navbar.standard', 'hero.minimal', 'services.grid', 'gallery.grid', 'pricing-table.tiers', 'cta.band', 'footer.standard'],
      gallery: ['navbar.standard', 'hero.minimal', 'gallery.grid', 'testimonials.cards', 'footer.standard'],
      contact: ['navbar.standard', 'hero.minimal', 'contact-form.standard', 'faq.accordion', 'footer.standard'],
    },
    tokenSuggestions: {
      fonts: { headingHref: null, heading: '"Playfair Display", serif', body: 'Inter, sans-serif' },
    },
    bookingMode: 'reservation',
    commerceMode: 'none',
  },

  // ── feribot-bilet — ferry ticketing: routes/schedule, fares, ticket lean ──
  'feribot-bilet': {
    key: 'feribot-bilet',
    defaultPages: ['home', 'services', 'faq', 'contact'],
    componentPool: {
      // "services" expresses ROUTES/lines; pricing-table the FARES.
      // TODO: ticket-card / route-search when built (later batch) — services.grid +
      // pricing-table.tiers stand in for routes + fare classes for now.
      home: ['navbar.standard', 'navbar.left-logo-right-cta', 'hero.service-business', 'hero.split-image', 'services.grid', 'pricing-table.tiers', 'faq.accordion', 'cta.band', 'footer.standard'],
      services: ['navbar.standard', 'hero.minimal', 'services.grid', 'pricing-table.tiers', 'cta.band', 'footer.standard'],
      faq: ['navbar.standard', 'hero.minimal', 'faq.accordion', 'cta.band', 'footer.standard'],
      contact: ['navbar.standard', 'hero.minimal', 'contact-form.standard', 'faq.accordion', 'footer.standard'],
    },
    tokenSuggestions: {
      fonts: { headingHref: null, heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
    },
    bookingMode: 'ticket',
    commerceMode: 'none',
  },

  // ── klinik — clinic/medical: treatments, trust, team, appointment lean ──
  klinik: {
    key: 'klinik',
    defaultPages: ['home', 'services', 'about', 'contact'],
    componentPool: {
      // "services" = treatments; testimonials carry patient trust.
      home: ['navbar.standard', 'navbar.left-logo-right-cta', 'hero.service-business', 'hero.corporate', 'services.grid', 'testimonials.cards', 'faq.accordion', 'cta.band', 'footer.standard'],
      services: ['navbar.standard', 'hero.minimal', 'services.grid', 'pricing-table.tiers', 'faq.accordion', 'cta.band', 'footer.standard'],
      about: ['navbar.standard', 'hero.split-image', 'services.grid', 'testimonials.cards', 'footer.standard'],
      contact: ['navbar.standard', 'hero.minimal', 'contact-form.standard', 'faq.accordion', 'footer.standard'],
    },
    tokenSuggestions: {
      fonts: { headingHref: null, heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
    },
    bookingMode: 'reservation',
    commerceMode: 'none',
  },

  // ── ajans — creative/marketing agency: portfolio, services, proof ──
  ajans: {
    key: 'ajans',
    defaultPages: ['home', 'services', 'gallery', 'contact'],
    componentPool: {
      home: ['navbar.standard', 'navbar.centered-logo', 'navbar.left-logo-right-cta', 'hero.minimal', 'hero.split-image', 'hero.corporate', 'services.grid', 'gallery.grid', 'testimonials.cards', 'pricing-table.tiers', 'cta.band', 'footer.standard'],
      services: ['navbar.standard', 'hero.minimal', 'services.grid', 'pricing-table.tiers', 'faq.accordion', 'cta.band', 'footer.standard'],
      gallery: ['navbar.standard', 'hero.minimal', 'gallery.grid', 'testimonials.cards', 'cta.band', 'footer.standard'],
      contact: ['navbar.standard', 'hero.minimal', 'contact-form.standard', 'faq.accordion', 'footer.standard'],
    },
    tokenSuggestions: {
      fonts: { headingHref: null, heading: '"Space Grotesk", sans-serif', body: 'Inter, sans-serif' },
    },
    bookingMode: 'none',
    commerceMode: 'none',
  },

  // ── e-ticaret — e-commerce storefront: product showcase, proof, pricing ──
  'e-ticaret': {
    key: 'e-ticaret',
    defaultPages: ['home', 'products', 'about', 'contact'],
    componentPool: {
      // "products" page leans on gallery.grid (product showcase) + services.grid
      // (categories/value props) + pricing-table.tiers (plans/offers).
      // TODO: product-card / product-list / ecommerce-grid / cart-drawer when built
      // (later batch) — gallery.grid + services.grid + pricing-table.tiers stand in.
      home: ['navbar.standard', 'navbar.left-logo-right-cta', 'hero.full-background', 'hero.split-image', 'services.grid', 'gallery.grid', 'testimonials.cards', 'cta.band', 'footer.standard'],
      products: ['navbar.standard', 'hero.minimal', 'gallery.grid', 'services.grid', 'pricing-table.tiers', 'cta.band', 'footer.standard'],
      about: ['navbar.standard', 'hero.split-image', 'services.grid', 'testimonials.cards', 'footer.standard'],
      contact: ['navbar.standard', 'hero.minimal', 'contact-form.standard', 'faq.accordion', 'footer.standard'],
    },
    tokenSuggestions: {
      fonts: { headingHref: null, heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
    },
    bookingMode: 'none',
    commerceMode: 'ecommerce',
  },

  // ── kurumsal — corporate/B2B: authority, services, stats, contact ──
  kurumsal: {
    key: 'kurumsal',
    defaultPages: ['home', 'about', 'services', 'contact'],
    componentPool: {
      home: ['navbar.standard', 'navbar.left-logo-right-cta', 'hero.corporate', 'hero.split-image', 'services.grid', 'testimonials.cards', 'pricing-table.tiers', 'cta.band', 'footer.standard'],
      about: ['navbar.standard', 'hero.split-image', 'hero.corporate', 'services.grid', 'testimonials.cards', 'footer.standard'],
      services: ['navbar.standard', 'hero.minimal', 'services.grid', 'pricing-table.tiers', 'faq.accordion', 'cta.band', 'footer.standard'],
      contact: ['navbar.standard', 'hero.minimal', 'contact-form.standard', 'faq.accordion', 'footer.standard'],
    },
    tokenSuggestions: {
      fonts: { headingHref: null, heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
    },
    bookingMode: 'none',
    commerceMode: 'none',
  },

  // ── hizmet-landing — single-purpose service landing: conversion-first ──
  'hizmet-landing': {
    key: 'hizmet-landing',
    defaultPages: ['home', 'services', 'contact'],
    componentPool: {
      home: ['navbar.standard', 'navbar.left-logo-right-cta', 'hero.service-business', 'hero.split-image', 'hero.full-background', 'services.grid', 'testimonials.cards', 'pricing-table.tiers', 'faq.accordion', 'cta.band', 'footer.standard'],
      services: ['navbar.standard', 'hero.minimal', 'services.grid', 'pricing-table.tiers', 'faq.accordion', 'cta.band', 'footer.standard'],
      contact: ['navbar.standard', 'hero.minimal', 'contact-form.standard', 'faq.accordion', 'footer.standard'],
    },
    tokenSuggestions: {
      fonts: { headingHref: null, heading: '"Space Grotesk", sans-serif', body: 'Inter, sans-serif' },
    },
    bookingMode: 'none',
    commerceMode: 'none',
  },

  // ── rezervasyon — booking/appointment business (salon, studio, tour): reservation lean ──
  rezervasyon: {
    key: 'rezervasyon',
    defaultPages: ['home', 'services', 'gallery', 'contact'],
    componentPool: {
      // TODO: reservation-form / package-card when built (later batch) —
      // services.grid (offerings) + pricing-table.tiers (packages) + the contact
      // form stand in for the booking flow.
      home: ['navbar.standard', 'navbar.centered-logo', 'hero.service-business', 'hero.split-image', 'services.grid', 'gallery.grid', 'testimonials.cards', 'pricing-table.tiers', 'cta.band', 'footer.standard'],
      services: ['navbar.standard', 'hero.minimal', 'services.grid', 'pricing-table.tiers', 'faq.accordion', 'cta.band', 'footer.standard'],
      gallery: ['navbar.standard', 'hero.minimal', 'gallery.grid', 'testimonials.cards', 'cta.band', 'footer.standard'],
      contact: ['navbar.standard', 'hero.minimal', 'contact-form.standard', 'faq.accordion', 'footer.standard'],
    },
    tokenSuggestions: {
      fonts: { headingHref: null, heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
    },
    bookingMode: 'reservation',
    commerceMode: 'none',
  },

  // ── egitim — education/course/academy: programs, proof, enrollment ──
  egitim: {
    key: 'egitim',
    defaultPages: ['home', 'services', 'about', 'contact'],
    componentPool: {
      // "services" = programs/courses; pricing-table = tuition/plans.
      home: ['navbar.standard', 'navbar.centered-logo', 'hero.corporate', 'hero.split-image', 'services.grid', 'testimonials.cards', 'pricing-table.tiers', 'faq.accordion', 'cta.band', 'footer.standard'],
      services: ['navbar.standard', 'hero.minimal', 'services.grid', 'pricing-table.tiers', 'faq.accordion', 'cta.band', 'footer.standard'],
      about: ['navbar.standard', 'hero.split-image', 'services.grid', 'testimonials.cards', 'gallery.grid', 'footer.standard'],
      contact: ['navbar.standard', 'hero.minimal', 'contact-form.standard', 'faq.accordion', 'footer.standard'],
    },
    tokenSuggestions: {
      fonts: { headingHref: null, heading: '"DM Serif Display", serif', body: 'Inter, sans-serif' },
    },
    bookingMode: 'none',
    commerceMode: 'none',
  },

  // ── gayrimenkul — real estate: listings, gallery, trust, contact ──
  gayrimenkul: {
    key: 'gayrimenkul',
    defaultPages: ['home', 'gallery', 'services', 'contact'],
    componentPool: {
      // "gallery" = listings showcase; "services" = buy/sell/rent value props.
      // TODO: property-card / listing-grid when built (later batch) — gallery.grid +
      // services.grid + pricing-table.tiers stand in for listings + service tiers.
      home: ['navbar.standard', 'navbar.left-logo-right-cta', 'hero.full-background', 'hero.luxury', 'hero.split-image', 'services.grid', 'gallery.grid', 'testimonials.cards', 'cta.band', 'footer.standard'],
      gallery: ['navbar.standard', 'hero.minimal', 'gallery.grid', 'testimonials.cards', 'cta.band', 'footer.standard'],
      services: ['navbar.standard', 'hero.minimal', 'services.grid', 'pricing-table.tiers', 'faq.accordion', 'cta.band', 'footer.standard'],
      contact: ['navbar.standard', 'hero.minimal', 'contact-form.standard', 'faq.accordion', 'footer.standard'],
    },
    tokenSuggestions: {
      fonts: { headingHref: null, heading: '"Playfair Display", serif', body: 'Inter, sans-serif' },
    },
    bookingMode: 'none',
    commerceMode: 'none',
  },
}

// ---------------------------------------------------------------------------
// Pure helpers (re-exported by index.ts with types). Mark NAV/FOOTER/CONTACT
// pools as referenced so the shared-pool constants are not flagged unused — they
// document the always-present scaffolding components shared across templates.
// ---------------------------------------------------------------------------

/** Scaffolding pools shared across templates (navbar / footer / contact slots). */
export const SHARED_POOLS = {
  nav: NAV_POOL,
  footer: FOOTER_POOL,
  contact: CONTACT_POOL,
}

/** All registered industry template keys, in registry order. */
export function listIndustryTemplateKeys() {
  return Object.keys(INDUSTRY_TEMPLATES)
}

/** Look up an IndustryTemplate by key (undefined if unknown). */
export function getIndustryTemplate(key) {
  if (typeof key !== 'string') return undefined
  return INDUSTRY_TEMPLATES[key]
}

/**
 * Every distinct component key referenced by ANY template's componentPool —
 * used by the verify script to assert no template references a non-registry key.
 * @returns {string[]}
 */
export function allPooledComponentKeys() {
  const set = new Set()
  for (const tpl of Object.values(INDUSTRY_TEMPLATES)) {
    for (const role of Object.keys(tpl.componentPool || {})) {
      for (const key of tpl.componentPool[role] || []) set.add(key)
    }
  }
  return [...set]
}
