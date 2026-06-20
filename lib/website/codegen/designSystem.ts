/* ──────────────────────────────────────────────────────────
   Web Site Yöneticisi — Stage 1: Design System (Opus 4.8)

   Produces a NUMERIC design system (palette / fonts / spacing /
   shadows / gradients / motion) from the site's CodegenContext.
   This is what makes each generated site visually distinct.

   Key decisions:
   - Uses Opus 4.8 with adaptive thinking + effort:high for rich
     creative output — DO NOT send temperature/top_p/top_k/budget_tokens.
   - Full color freedom: the YoAi dashboard's amber/yellow ban does NOT
     apply here — customer marketing sites may use any brand-appropriate
     palette. A honey brand SHOULD get amber/gold. (See DesignSystem JSDoc.)
   - Soft-fail: returns the safe default DesignSystem on any error so the
     pipeline never hard-crashes.
   - CSS-safety: all token values are validated before return (see
     designSystemValidate.mjs). Values are safe for :root{ --x: VALUE }.
   ────────────────────────────────────────────────────────── */

import { getAnthropicClient, isAnthropicReady } from '@/lib/anthropic/client'
import { extractJsonObject } from '@/lib/anthropic/text'
import type { CodegenContext, DesignSystem } from './types'

// ---------------------------------------------------------------------------
// Import pure validate helpers from the shared .mjs module
// (the same module used by verify-website-codegen.mjs — single source of truth).
// STATIC literal specifier so Turbopack/webpack can resolve it (mirrors
// assembleDocument.ts ↔ assembleDocument.mjs).
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import {
  validateDesignSystem as _validateDesignSystem,
  SAFE_DEFAULT_DESIGN_SYSTEM as _SAFE_DEFAULT_DESIGN_SYSTEM,
} from './designSystemValidate.mjs'

const validateDesignSystem = _validateDesignSystem as (raw: unknown) => DesignSystem
const safeDefault = _SAFE_DEFAULT_DESIGN_SYSTEM as DesignSystem

// ---------------------------------------------------------------------------
// Model constant
// ---------------------------------------------------------------------------

const MODEL = process.env.ANTHROPIC_MODEL_WEBSITE_INITIAL ?? 'claude-opus-4-8'

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM = `You are a world-class web design system architect. Your sole task is to produce a precise, numeric design system JSON for a marketing website. You must output ONLY a single valid JSON object — no markdown fences, no explanation, no comments, no trailing text.

Design philosophy (decide like a senior brand designer — avoid generic AI-template aesthetics):
- Anti-generic: choose a palette that is DISTINCTIVE and brand-appropriate. Avoid default blue/indigo. Pick ONE signature brand color and commit to it — a dominant accent with sharp, derived accents, not a timid evenly-grey set. Derive the full palette (ink, accentSoft, surface, onAccent, muted, border) from it with proper contrast.
- Layered depth: shadows must be multi-layer with low-opacity, color-tinted offsets (subtle → medium → elevated). No flat shadow-md equivalents.
- TYPOGRAPHY (distinctive pairing — the highest-leverage choice): pair a CHARACTERFUL display heading font with a clean, refined sans body font, and match the pairing to the brand's mood (e.g. editorial serif "Fraunces"/"Playfair Display"/"DM Serif Display" or a confident geometric/grotesk display "Clash Display"/"Space Grotesk"/"Sora" for heading; "Inter"/"Manrope"/"Sora"/"Plus Jakarta Sans"/"Work Sans"/"Outfit" for body). AVOID generic defaults as the DISPLAY/heading choice (no Inter, Roboto, Arial, Open Sans, Lato, or system-ui as the heading face — those are body/neutral only). Never use the same family for heading and body. Large headings imply tight tracking; body implies relaxed line-height (the HTML layer applies these).
- FONT LOADABILITY (hard requirement): every font family you name MUST be a real Google Fonts family, and headingHref MUST be a single valid "https://fonts.googleapis.com/css2?family=...&family=...&display=swap" URL that loads BOTH the heading AND the body families (with their needed weights/italics). The font-family strings must exactly match the Google Fonts family names you requested in that URL — if a family is not in the headingHref it will not load on the page. Use only families that actually exist on Google Fonts.
- Rhythm: spacing and radius scales must be coherent geometric or harmonic sequences.
- Motion: spring-style easing (cubic-bezier with overshoot). Animate only transform+opacity.
- Color freedom: you may use ANY hue — amber, gold, terracotta, sage, crimson — whatever best fits the brand. Do NOT restrict yourself to "safe" or generic palettes.

CSS-safety requirements (CRITICAL — values go directly into CSS custom properties):
- Colors: ONLY hex (#rgb, #rrggbb, #rrggbbaa) or rgb()/rgba()/hsl()/hsla() notation, or: transparent, white, black, currentColor.
- Lengths: ONLY numbers + px/rem/em/% (e.g. "1.5rem", "24px"). No calc(), no var().
- No semicolons, curly braces, angle brackets, backslashes, or @import in any value.
- Font family strings: quoted names + generic families only, e.g. '"DM Serif Display", Georgia, serif'.
- Shadow/gradient values: valid CSS shadow/gradient strings only. No url() references.
- Easing: cubic-bezier(...) or named keywords (ease, ease-in, ease-out, ease-in-out, linear) only.
- headingHref: a valid https://fonts.googleapis.com/css2?... URL, or null.`

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildUserMessage(ctx: CodegenContext): string {
  const lines: string[] = []
  lines.push(`Generate a design system for the following website:`)
  lines.push(`Brand name: ${ctx.brandName}`)
  if (ctx.style) {
    // Çıplak anahtar kelime ("modern") DEĞİL — tarzın zengin direktifini bas.
    // styleDirective varsa onu kullan (örn. "modern" = animasyonlu/kinetik/dinamik);
    // yoksa çıplak style'a düş (geriye dönük uyumlu).
    lines.push(
      ctx.styleDirective
        ? `Style direction (${ctx.style}): ${ctx.styleDirective}`
        : `Style direction: ${ctx.style}`,
    )
  }
  if (ctx.instruction) lines.push(`Designer's instruction: ${ctx.instruction}`)
  if (ctx.locale) lines.push(`Locale/language: ${ctx.locale}`)

  if (ctx.untrustedBlocks.length > 0) {
    lines.push(`\nBrand context (external, read-only):`)
    for (const block of ctx.untrustedBlocks) {
      lines.push(block)
    }
  }

  lines.push(`
Return ONLY this JSON object (no fences, no explanation):
{
  "palette": {
    "ink": "<primary text color>",
    "accent": "<brand accent — full color freedom, pick something distinctive>",
    "accentSoft": "<tinted soft accent for backgrounds/badges>",
    "surface": "<page/card background>",
    "onAccent": "<text color on accent backgrounds>",
    "muted": "<secondary/muted text color>",
    "border": "<default border color>"
  },
  "fonts": {
    "headingHref": "<single https://fonts.googleapis.com/css2 URL loading BOTH families with &family=...&display=swap — required for the fonts to render>",
    "heading": "<CSS font-family for headings — a CHARACTERFUL display/serif Google font, NOT Inter/Roboto/Arial/system>",
    "body": "<CSS font-family for body — a clean refined sans Google font, different family from the heading>"
  },
  "spacingScale": ["<8 CSS length values, smallest to largest>"],
  "radiusScale": ["<6 CSS border-radius values, from slight to full-pill>"],
  "shadowRecipes": ["<3 multi-layer box-shadow strings: subtle, medium, elevated>"],
  "gradientRecipes": ["<3 CSS gradient strings: brand gradient, radial glow, overlay>"],
  "motion": {
    "easing": "<cubic-bezier with slight overshoot for spring feel>",
    "durations": [<micro ms>, <standard ms>, <emphasis ms>]
  }
}`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Parse AI text response → raw object
// ---------------------------------------------------------------------------

function parseDesignSystemText(text: string | null): unknown {
  if (!text) return null
  try {
    return JSON.parse(extractJsonObject(text))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Stage-1: Generate a brand-specific DesignSystem via Opus 4.8.
 *
 * - Adaptive thinking + effort:high for creative depth.
 * - No temperature/top_p/top_k/budget_tokens (Opus 4.8 rejects them).
 * - All returned values are CSS-safe (validated by designSystemValidate.mjs).
 * - Soft-fails to SAFE_DEFAULT_DESIGN_SYSTEM on any error.
 */
export async function generateDesignSystem(ctx: CodegenContext): Promise<DesignSystem> {
  if (!isAnthropicReady()) {
    console.warn('[designSystem] Anthropic not ready — using safe default')
    return { ...safeDefault, palette: { ...safeDefault.palette }, fonts: { ...safeDefault.fonts }, motion: { ...safeDefault.motion } }
  }

  try {
    const client = getAnthropicClient()

    // CRITICAL: Do NOT add temperature, top_p, top_k, or budget_tokens.
    // Opus 4.8 returns HTTP 400 for any of those parameters.
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinking: { type: 'adaptive' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output_config: { effort: 'high' } as any,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildUserMessage(ctx) }],
    })

    // Extract text blocks (skip thinking blocks)
    let text: string | null = null
    for (const block of res.content) {
      if (block.type === 'text') {
        text = block.text
        break
      }
    }

    const raw = parseDesignSystemText(text)
    if (!raw) {
      console.warn('[designSystem] parse failed — using safe default')
      return { ...safeDefault, palette: { ...safeDefault.palette }, fonts: { ...safeDefault.fonts }, motion: { ...safeDefault.motion } }
    }

    // Validate + coerce all token values to be CSS-safe
    return validateDesignSystem(raw)
  } catch (e) {
    console.warn('[designSystem] soft-fail:', e instanceof Error ? e.message : e)
    return { ...safeDefault, palette: { ...safeDefault.palette }, fonts: { ...safeDefault.fonts }, motion: { ...safeDefault.motion } }
  }
}
