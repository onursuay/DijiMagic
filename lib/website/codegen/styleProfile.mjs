/**
 * lib/website/codegen/styleProfile.mjs
 *
 * PURE, DEPENDENCY-FREE glue that turns the CREATE-MODAL choices (siteStyle +
 * fontPairing) and a scanned reference summary into ACTIVE generation signals
 * for the LIBRARY path (#builder-6):
 *
 *   - styleProfileFor(siteStyle)         → a rich design DIRECTIVE (mood / palette
 *                                          temperature / shadow / motion guidance)
 *                                          + a PREFERRED HERO componentKey bias
 *                                          (luxury → hero.luxury, corporate →
 *                                          hero.corporate, …) so the wizard's tarz
 *                                          choice genuinely shapes designSystem +
 *                                          the blueprint, not just gets stored.
 *   - extractDesignDna(referenceSummary) → an ABSTRACT design-DNA line (dominant
 *                                          color family, typography tone, layout
 *                                          rhythm, sector signal) derived from a
 *                                          reference scrape. NOT copied HTML / text /
 *                                          images — only an inspiration abstraction
 *                                          (master plan §5.4 anti-clone safeguard).
 *
 * Importable by BOTH the TS context builder / generators AND
 * scripts/verify-website-codegen.mjs (plain Node, no TS build, no live API) —
 * mirrors sourcePriority.mjs / librarySiteShared.mjs.
 *
 * No Date / Math.random — fully deterministic.
 */

/**
 * @typedef {Object} StyleProfile
 * @property {string} id            the canonical style id ('modern' | … )
 * @property {string} directive     a rich, prompt-ready design directive (EN — the
 *                                  designSystem/blueprint prompts are English)
 * @property {string} preferredHero a real hero componentKey to BIAS toward, or ''
 * @property {string} fontMood      a short typography mood hint for the prompt
 */

/**
 * The six wizard styles (mirror SITE_STYLE_PRESETS in lib/website/render/theme.ts).
 * Each maps to:
 *   - directive    : a concrete, English design directive the Opus designSystem
 *                    prompt acts on (palette temperature, contrast, shadow depth,
 *                    motion energy, radius feel) — so the PRODUCED tokens reflect it.
 *   - preferredHero: a real registry hero key the blueprint should lean toward
 *                    (deterministic fallback honours it; the AI prompt is told to
 *                    prefer it). '' = no structural bias (let the seed decide).
 *   - fontMood     : a typography mood the prompt uses when the user did NOT pin a
 *                    specific font pairing.
 */
const STYLE_PROFILES = {
  modern: {
    id: 'modern',
    directive:
      'MODERN: clean, contemporary, airy. Favor a crisp neutral-cool surface with ONE confident accent; ' +
      'generous white space; medium border-radius; soft, low-opacity layered shadows; quick, restrained motion. ' +
      'Avoid ornamentation — let spacing and a single accent carry the brand.',
    preferredHero: 'hero.minimal',
    fontMood: 'a clean geometric/grotesk sans with an optional characterful display heading',
  },
  corporate: {
    id: 'corporate',
    directive:
      'CORPORATE: professional, trustworthy, structured. Favor a deep navy/slate ink with a measured, serious accent; ' +
      'tight, orderly spacing; small-to-medium radius; crisp, shallow shadows; minimal, dignified motion. ' +
      'Convey authority and reliability — nothing flashy.',
    preferredHero: 'hero.corporate',
    fontMood: 'a refined serif or a sober grotesk heading with a neutral sans body',
  },
  playful: {
    id: 'playful',
    directive:
      'PLAYFUL: warm, friendly, energetic. Favor a warm, inviting palette with a lively (but balanced) accent; ' +
      'rounder corners (larger radius); soft, friendly shadows; bouncier spring motion with a little overshoot. ' +
      'Inviting and approachable, never childish.',
    preferredHero: 'hero.split-image',
    fontMood: 'a rounded, friendly sans display with a comfortable sans body',
  },
  luxury: {
    id: 'luxury',
    directive:
      'LUXURY: elegant, premium, sophisticated. Favor a dark/ink base with a metallic or jewel-tone accent (gold/' +
      'champagne/deep emerald); very generous breathing room; restrained radius; deep, soft, refined shadows; ' +
      'slow, graceful motion. Editorial serif feeling for headings; understated and expensive.',
    preferredHero: 'hero.luxury',
    fontMood: 'an editorial serif display heading paired with a refined sans body',
  },
  minimal: {
    id: 'minimal',
    directive:
      'MINIMAL: typography-led, restrained. Favor a near-monochrome surface with a single quiet accent; ' +
      'maximum white space; small radius; barely-there shadows; subtle, minimal motion. ' +
      'Every element earns its place — remove anything decorative.',
    preferredHero: 'hero.minimal',
    fontMood: 'a precise grotesk/sans with a strong typographic hierarchy',
  },
  vibrant: {
    id: 'vibrant',
    directive:
      'VIBRANT: bold, energetic, attention-grabbing. Favor a saturated, high-contrast palette with a strong accent ' +
      'and confident gradients; punchy spacing; medium-large radius; bold, color-tinted shadows; lively spring motion. ' +
      'Big, expressive typography — make a statement.',
    preferredHero: 'hero.full-background',
    fontMood: 'a bold, expressive display heading with a clean high-legibility body',
  },
}

/** The canonical style ids (membership checks / verify). */
export const STYLE_PROFILE_IDS = Object.keys(STYLE_PROFILES)

/**
 * Resolve the StyleProfile for a wizard style id. Unknown/absent → 'modern' (the
 * wizard's own default), so the library path always has a concrete directive.
 *
 * @param {string|null|undefined} style
 * @returns {StyleProfile}
 */
export function styleProfileFor(style) {
  const id = typeof style === 'string' ? style.trim().toLowerCase() : ''
  return STYLE_PROFILES[id] || STYLE_PROFILES.modern
}

// ---------------------------------------------------------------------------
// Abstract design-DNA extraction (master plan §5.4).
//
// Takes a referenceScanner summary line (already a quarantined, scraped abstract:
// "URL: … | Başlık: … | Tema rengi: #rrggbb | Üst menü (header): … | Bölüm/başlık
// akışı (layout): …") and distils it into an ABSTRACT inspiration line — NEVER the
// reference's verbatim copy, images, or markup. We extract:
//   - dominant COLOR FAMILY (named bucket from a theme-color hex, if present),
//   - layout RHYTHM (how many sections / nav-link density → "compact" / "rich"),
//   - a coarse SECTOR SIGNAL (from heading keywords),
// and emit a short, neutral sentence the designSystem/blueprint can use as MOOD
// inspiration. The reference's own text stays in its own quarantined block; this
// is a derived ABSTRACTION, so even the inspiration channel carries no copyable
// content.
// ---------------------------------------------------------------------------

/** Map a hex color to a coarse, NAMED color family (no exact value leaks). */
function colorFamily(hex) {
  if (typeof hex !== 'string') return ''
  const m = /#?([0-9a-fA-F]{6})/.exec(hex.trim())
  if (!m) return ''
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  // Near-greyscale → judge by lightness.
  if (d < 24) {
    if (max > 200) return 'light neutral'
    if (max < 70) return 'dark neutral'
    return 'mid neutral'
  }
  // Hue bucket (degrees) on the dominant channel.
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h = (h * 60 + 360) % 360
  if (h < 20 || h >= 345) return 'red'
  if (h < 45) return 'orange'
  if (h < 70) return 'amber/gold'
  if (h < 160) return 'green'
  if (h < 200) return 'teal'
  if (h < 250) return 'blue'
  if (h < 290) return 'violet'
  return 'magenta/pink'
}

/** Coarse layout rhythm from an approximate section count / nav density. */
function layoutRhythm(summary) {
  const secM = /bölüm say[ıi]s[ıi]:\s*(\d+)/i.exec(summary)
  const sections = secM ? parseInt(secM[1], 10) : 0
  const navM = /(?:Üst menü|header)[^|]*?:\s*([^|]+)/i.exec(summary)
  const navCount = navM ? navM[1].split(',').filter((s) => s.trim()).length : 0
  if (sections >= 8 || navCount >= 7) return 'content-rich, multi-section'
  if (sections >= 4 || navCount >= 4) return 'balanced, several sections'
  if (sections > 0 || navCount > 0) return 'compact, focused'
  return ''
}

/** A coarse sector signal from heading/title keywords (TR + EN), or ''. */
function sectorSignal(summary) {
  const s = summary.toLowerCase()
  const groups = [
    ['hospitality', ['otel', 'hotel', 'resort', 'konaklama', 'restaurant', 'restoran', 'cafe', 'menu', 'menü']],
    ['health/clinic', ['klinik', 'clinic', 'sağlık', 'health', 'dental', 'diş', 'doktor', 'medical']],
    ['real estate', ['emlak', 'gayrimenkul', 'real estate', 'konut', 'satılık', 'kiralık', 'property']],
    ['agency/creative', ['ajans', 'agency', 'studio', 'stüdyo', 'portfolio', 'portföy', 'kreatif', 'creative']],
    ['ecommerce', ['mağaza', 'shop', 'store', 'ürün', 'product', 'sepet', 'cart', 'satın al']],
    ['education', ['eğitim', 'education', 'kurs', 'course', 'akademi', 'academy', 'okul', 'school']],
    ['corporate/B2B', ['kurumsal', 'corporate', 'b2b', 'danışmanlık', 'consulting', 'hizmet', 'service', 'çözüm', 'solution']],
  ]
  for (const [label, words] of groups) {
    if (words.some((w) => s.includes(w))) return label
  }
  return ''
}

/**
 * Distil ONE reference-scan summary into an ABSTRACT design-DNA inspiration line.
 * Returns '' when nothing useful can be abstracted (so callers can skip empties).
 *
 * The output is a derived ABSTRACTION (color family / rhythm / sector mood) — it
 * deliberately contains NONE of the reference's verbatim copy, brand names, image
 * URLs, or markup. Anti-clone: this guides MOOD, not content.
 *
 * @param {string|null|undefined} summary  a referenceScanner summary line
 * @returns {string}
 */
export function extractDesignDna(summary) {
  if (typeof summary !== 'string' || !summary.trim()) return ''
  const themeM = /Tema rengi:\s*([^|]+)/i.exec(summary)
  const fam = themeM ? colorFamily(themeM[1]) : ''
  const rhythm = layoutRhythm(summary)
  const sector = sectorSignal(summary)

  const parts = []
  if (fam) parts.push(`dominant color family: ${fam}`)
  if (rhythm) parts.push(`layout rhythm: ${rhythm}`)
  if (sector) parts.push(`sector signal: ${sector}`)
  if (parts.length === 0) return ''
  return parts.join('; ')
}

/**
 * Build a combined abstract design-DNA summary from MANY reference summaries.
 * De-duplicates the abstracted lines (multiple refs often share a family/rhythm).
 * Returns '' when nothing abstractable.
 *
 * @param {string[]} summaries  referenceScanner summary lines
 * @returns {string}
 */
export function summariseDesignDna(summaries) {
  const list = Array.isArray(summaries) ? summaries : []
  const seen = new Set()
  const lines = []
  for (const s of list) {
    const dna = extractDesignDna(s)
    if (dna && !seen.has(dna)) {
      seen.add(dna)
      lines.push(dna)
    }
  }
  return lines.join(' · ')
}
