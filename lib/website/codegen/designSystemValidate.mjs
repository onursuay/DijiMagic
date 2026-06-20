/**
 * lib/website/codegen/designSystemValidate.mjs
 *
 * Pure ESM module: DesignSystem token validation + safe default.
 * Importable by both designSystem.ts (via TS + bundler) and the
 * verify script (node scripts/verify-website-codegen.mjs).
 *
 * Security contract: every CSS-bound token value is validated to be safe
 * for embedding directly in <style>:root{ --x: VALUE }. Any value that
 * could break out of the :root block or inject scripts is replaced with
 * a safe hardcoded default.
 */

// ---------------------------------------------------------------------------
// Safe default DesignSystem — neutral palette + clean font pairing
// Used when the API is unavailable, call fails, or validation cannot salvage
// ---------------------------------------------------------------------------

export const SAFE_DEFAULT_DESIGN_SYSTEM = {
  palette: {
    ink: '#1a1a2e',
    accent: '#059669',
    accentSoft: '#d1fae5',
    surface: '#ffffff',
    onAccent: '#ffffff',
    muted: '#6b7280',
    border: '#e5e7eb',
  },
  fonts: {
    headingHref: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600&display=swap',
    heading: '"DM Serif Display", Georgia, serif',
    body: 'Inter, system-ui, -apple-system, sans-serif',
  },
  spacingScale: ['0.25rem', '0.5rem', '1rem', '1.5rem', '2rem', '3rem', '4rem', '6rem'],
  radiusScale: ['0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '9999px'],
  shadowRecipes: [
    '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    '0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)',
    '0 8px 32px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)',
  ],
  gradientRecipes: [
    'linear-gradient(135deg, #059669 0%, #065f46 100%)',
    'radial-gradient(ellipse at 60% 20%, rgba(5,150,105,0.15) 0%, transparent 60%)',
    'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 100%)',
  ],
  motion: {
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    durations: [150, 250, 400],
  },
}

// ---------------------------------------------------------------------------
// Token safety patterns
// ---------------------------------------------------------------------------

// Allowed safe CSS color patterns (hex, rgb, rgba, hsl, hsla, safe named)
const SAFE_HEX_RE = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const SAFE_RGB_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*[\d.]+)?\s*\)$/
const SAFE_HSL_RE = /^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(\s*,\s*[\d.]+)?\s*\)$/
const SAFE_NAMED_COLORS = new Set([
  'transparent', 'white', 'black', 'currentcolor', 'inherit', 'initial', 'unset',
])

// CSS length pattern (px, rem, em, %, unitless zero)
const SAFE_LENGTH_RE = /^(\d+(\.\d+)?(px|rem|em|%)|0)$/

// Dangerous patterns for any CSS value
const DANGEROUS_RE = /[}{;<>\\]|@import|url\s*\(\s*javascript|<\/style>/i

// ---------------------------------------------------------------------------
// Coerce a single token value to be CSS-safe
// Returns the value if safe, or the fallback if not
// ---------------------------------------------------------------------------

/**
 * @param {unknown} value - the token value to check
 * @param {string} fallback - the safe fallback to return if value is unsafe
 * @param {'color'|'length'|'font'|'shadow'|'gradient'|'easing'|'any'} kind
 * @returns {string}
 */
export function coerceTokenValue(value, fallback, kind = 'any') {
  if (typeof value !== 'string') return fallback
  const v = value.trim()

  // Reject anything with dangerous sequences regardless of kind
  if (DANGEROUS_RE.test(v)) return fallback
  if (!v) return fallback

  if (kind === 'color') {
    if (
      SAFE_HEX_RE.test(v) ||
      SAFE_RGB_RE.test(v) ||
      SAFE_HSL_RE.test(v) ||
      SAFE_NAMED_COLORS.has(v.toLowerCase())
    ) return v
    return fallback
  }

  if (kind === 'length') {
    if (SAFE_LENGTH_RE.test(v)) return v
    return fallback
  }

  if (kind === 'font') {
    // Font family strings: allow alphanumeric, spaces, quotes, commas, hyphens, dots
    // The safe regex still blocks {} ; < > \ @import etc. (caught above already)
    // Additional check: no unmatched quotes that could escape attribute context
    if (/^[a-zA-Z0-9\s"',.\-_+/öüşçğıÖÜŞÇĞI]*$/.test(v)) return v
    // Accept common system-ui / generic family names (may contain special chars)
    // Fallback if anything suspicious
    return fallback
  }

  if (kind === 'shadow') {
    // Shadow values: numbers, px/rem/%, rgba/hsla, commas, spaces
    // Already passed DANGEROUS_RE check above; additionally block url() references
    if (/url\s*\(/i.test(v)) return fallback
    return v
  }

  if (kind === 'gradient') {
    if (/url\s*\(/i.test(v)) return fallback
    return v
  }

  if (kind === 'easing') {
    // cubic-bezier(...) or named keywords
    if (/^(cubic-bezier\([\d.,\s-]+\)|ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)$/i.test(v)) return v
    return fallback
  }

  // 'any' — already passed DANGEROUS_RE check
  return v
}

// ---------------------------------------------------------------------------
// Neutral-surface guard (defense-in-depth for the 60-30-10 accent discipline)
//
// The prompts (designSystem.ts + htmlGenerateShared.mjs) instruct the model to
// keep the page background NEUTRAL and use the brand color only as an accent.
// This guard is the SAFETY NET: even if the model ignores the prompt and emits a
// brand-tinted `surface` (e.g. a navy page when the brand color is navy), we
// coerce `surface` back to a neutral so the generated site never floods the page
// with the brand hue. It is intentionally conservative — it only rewrites
// `surface` when it is CLEARLY brand-tinted, never on a legitimate neutral.
// ---------------------------------------------------------------------------

/**
 * Parse a CSS-safe color string (hex / rgb()/rgba() / hsl()/hsla()) into HSL.
 * Returns null for values we cannot interpret (named colors, transparent, …) —
 * the caller then leaves `surface` untouched (fail-open, never crash).
 *
 * @param {string} value - an ALREADY css-safe color string (post coerceTokenValue)
 * @returns {{ h: number, s: number, l: number } | null}  h in [0,360), s/l in [0,1]
 */
export function colorToHsl(value) {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()

  /** @type {number|null} */ let r = null
  /** @type {number|null} */ let g = null
  /** @type {number|null} */ let b = null

  // hsl()/hsla() — read HSL directly (no RGB round-trip needed)
  const hslM = v.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/)
  if (hslM) {
    const h = ((Number(hslM[1]) % 360) + 360) % 360
    const s = Math.min(1, Math.max(0, Number(hslM[2]) / 100))
    const l = Math.min(1, Math.max(0, Number(hslM[3]) / 100))
    return { h, s, l }
  }

  // rgb()/rgba()
  const rgbM = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/)
  if (rgbM) {
    r = Number(rgbM[1]); g = Number(rgbM[2]); b = Number(rgbM[3])
  } else {
    // hex (#rgb, #rgba, #rrggbb, #rrggbbaa) — alpha ignored for hue/sat/lum
    const hex = v.replace(/^#/, '')
    if (/^[0-9a-f]{3,4}$/.test(hex)) {
      r = parseInt(hex[0] + hex[0], 16)
      g = parseInt(hex[1] + hex[1], 16)
      b = parseInt(hex[2] + hex[2], 16)
    } else if (/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) {
      r = parseInt(hex.slice(0, 2), 16)
      g = parseInt(hex.slice(2, 4), 16)
      b = parseInt(hex.slice(4, 6), 16)
    } else {
      return null // named color / unknown → fail-open
    }
  }

  if (r === null || g === null || b === null) return null
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0, s = 0
  const dmax = max - min
  if (dmax !== 0) {
    s = l > 0.5 ? dmax / (2 - max - min) : dmax / (max + min)
    if (max === rn) h = ((gn - bn) / dmax + (gn < bn ? 6 : 0))
    else if (max === gn) h = (bn - rn) / dmax + 2
    else h = (rn - gn) / dmax + 4
    h *= 60
  }
  return { h, s, l }
}

/** Smallest absolute distance between two hues on the 0–360 circle. */
function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Guarantee a NEUTRAL page background. Given the (already css-safe) surface and
 * accent colors, decide whether `surface` is too brand-tinted and, if so, return
 * a neutral replacement; otherwise return the original surface unchanged.
 *
 * Coercion rule (conservative — only fires when surface is CLEARLY brand-tinted;
 * calibrated against real values so legitimate neutrals/deep-neutrals all pass):
 *   - parse surface → if it cannot be parsed, leave it (fail-open).
 *   - near-white (l ≥ 0.90) or near-black (l ≤ 0.085) are ALWAYS treated as
 *     neutral and left untouched — at the lightness extremes nominal HSL
 *     saturation is unreliable (e.g. cream #fffbeb reads s≈1.0 but is neutral),
 *     and the prompt's allowed deep-neutral darks (#0b0e12–#11151b) live here.
 *   - otherwise a surface is "brand-tinted" when saturation > 0.30 (deep-neutral
 *     darks measure ≤ 0.28; brand tints like navy measure ≥ 0.5), OR its hue is
 *     within 40° of the accent hue WITH meaningful saturation (> 0.30).
 *   When coercing, pick the neutral by THEME: light surface (l ≥ 0.5) → #ffffff,
 *   dark surface (l < 0.5) → #0c0f14 — so we never flip a dark theme to white.
 *
 * @param {string} surface  css-safe surface color
 * @param {string} accent   css-safe accent color
 * @returns {string}        a neutral surface if coercion fired, else the original
 */
export function ensureNeutralSurface(surface, accent) {
  const sHsl = colorToHsl(surface)
  if (!sHsl) return surface // unparseable → leave it (fail-open)

  // Lightness extremes are neutral regardless of nominal saturation: near-white
  // (cream / off-white) and near-black (deep-neutral dark themes) both pass.
  if (sHsl.l >= 0.90 || sHsl.l <= 0.085) return surface

  const SAT_LIMIT = 0.30
  if (sHsl.s <= SAT_LIMIT) return surface // mid-tone but low saturation → real neutral

  const aHsl = colorToHsl(accent)
  const sharesBrandHue = aHsl ? hueDistance(sHsl.h, aHsl.h) <= 40 : false

  // Above SAT_LIMIT the surface is a colored fill (and may also share the brand
  // hue) — not a legitimate neutral background. Coerce to a neutral by theme.
  if (sharesBrandHue || sHsl.s > SAT_LIMIT) {
    return sHsl.l >= 0.5 ? '#ffffff' : '#0c0f14'
  }
  return surface
}

// ---------------------------------------------------------------------------
// Validate + coerce a full DesignSystem-shaped object
// Returns a CSS-safe DesignSystem (guaranteed no injection vectors)
// ---------------------------------------------------------------------------

/**
 * @param {unknown} raw - the object to validate (typically parsed from AI output)
 * @returns {typeof SAFE_DEFAULT_DESIGN_SYSTEM}
 */
export function validateDesignSystem(raw) {
  const d = SAFE_DEFAULT_DESIGN_SYSTEM
  if (!raw || typeof raw !== 'object') return { ...d, palette: { ...d.palette }, fonts: { ...d.fonts }, motion: { ...d.motion } }

  const r = /** @type {Record<string, unknown>} */ (raw)

  // ── palette ──
  const rp = (r.palette && typeof r.palette === 'object') ? /** @type {Record<string, unknown>} */ (r.palette) : {}
  const def = d.palette

  const palette = {
    ink: coerceTokenValue(rp.ink, def.ink, 'color'),
    accent: coerceTokenValue(rp.accent, def.accent, 'color'),
    accentSoft: coerceTokenValue(rp.accentSoft, def.accentSoft, 'color'),
    surface: coerceTokenValue(rp.surface, def.surface, 'color'),
    onAccent: coerceTokenValue(rp.onAccent, def.onAccent, 'color'),
    muted: coerceTokenValue(rp.muted ?? rp.muted, def.muted, 'color'),
    border: coerceTokenValue(rp.border ?? rp.border, def.border, 'color'),
  }

  // Defense-in-depth: GUARANTEE a neutral page background even if the model
  // ignored the prompt and emitted a brand-tinted surface (the 60-30-10 fix).
  // Only rewrites `surface` when it is clearly a tint of the brand hue / too
  // saturated to be a real neutral; legitimate white/near-black surfaces pass.
  palette.surface = ensureNeutralSurface(palette.surface, palette.accent)

  // ── fonts ──
  const rf = (r.fonts && typeof r.fonts === 'object') ? /** @type {Record<string, unknown>} */ (r.fonts) : {}
  const df = d.fonts

  // headingHref: must be a safe URL (https://fonts.googleapis.com only) or null
  let headingHref = null
  if (typeof rf.headingHref === 'string' && rf.headingHref.trim()) {
    const h = rf.headingHref.trim()
    if (/^https:\/\/fonts\.googleapis\.com\//.test(h) && !DANGEROUS_RE.test(h)) {
      headingHref = h
    }
  }

  const fonts = {
    headingHref,
    heading: coerceTokenValue(rf.heading, df.heading, 'font'),
    body: coerceTokenValue(rf.body, df.body, 'font'),
  }

  // ── spacingScale ──
  const rawSpacing = Array.isArray(r.spacingScale) ? r.spacingScale : d.spacingScale
  const spacingScale = rawSpacing
    .map((v, i) => coerceTokenValue(v, d.spacingScale[i] ?? '1rem', 'length'))
    .filter(Boolean)
  const spacingScaleFinal = spacingScale.length > 0 ? spacingScale : [...d.spacingScale]

  // ── radiusScale ──
  const rawRadius = Array.isArray(r.radiusScale) ? r.radiusScale : d.radiusScale
  const radiusScale = rawRadius
    .map((v, i) => coerceTokenValue(v, d.radiusScale[i] ?? '0.5rem', 'length'))
    .filter(Boolean)
  const radiusScaleFinal = radiusScale.length > 0 ? radiusScale : [...d.radiusScale]

  // ── shadowRecipes ──
  const rawShadows = Array.isArray(r.shadowRecipes) ? r.shadowRecipes : d.shadowRecipes
  const shadowRecipes = rawShadows
    .map((v, i) => coerceTokenValue(v, d.shadowRecipes[i] ?? d.shadowRecipes[0], 'shadow'))
    .filter(Boolean)
  const shadowRecipesFinal = shadowRecipes.length > 0 ? shadowRecipes : [...d.shadowRecipes]

  // ── gradientRecipes ──
  const rawGradients = Array.isArray(r.gradientRecipes) ? r.gradientRecipes : d.gradientRecipes
  const gradientRecipes = rawGradients
    .map((v, i) => coerceTokenValue(v, d.gradientRecipes[i] ?? d.gradientRecipes[0], 'gradient'))
    .filter(Boolean)
  const gradientRecipesFinal = gradientRecipes.length > 0 ? gradientRecipes : [...d.gradientRecipes]

  // ── motion ──
  const rm = (r.motion && typeof r.motion === 'object') ? /** @type {Record<string, unknown>} */ (r.motion) : {}
  const dm = d.motion

  const easing = coerceTokenValue(rm.easing, dm.easing, 'easing')
  const rawDurations = Array.isArray(rm.durations) ? rm.durations : dm.durations
  const durations = rawDurations
    .map((v) => {
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) && n > 0 && n < 10000 ? Math.round(n) : null
    })
    .filter((v) => v !== null)
  const durationsFinal = durations.length > 0 ? durations : [...dm.durations]

  return {
    palette,
    fonts,
    spacingScale: spacingScaleFinal,
    radiusScale: radiusScaleFinal,
    shadowRecipes: shadowRecipesFinal,
    gradientRecipes: gradientRecipesFinal,
    motion: { easing, durations: durationsFinal },
  }
}
