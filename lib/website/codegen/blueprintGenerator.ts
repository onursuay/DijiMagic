import 'server-only'
/**
 * lib/website/codegen/blueprintGenerator.ts
 *
 * STAGE 1.5 — SITE BLUEPRINT GENERATION (Bölüm 4.7 / 5.1 of the master plan).
 *
 * Sits between Stage 1 (designSystem) and Stage 2/3 (multipagePlan/htmlGenerate).
 * Given the Stage-0 CodegenContext + the chosen industry template + the Stage-1
 * DesignSystem, ask Opus 4.8 to produce a SiteBlueprint (pages + per-page blocks
 * with componentKey/presetKey/archetype/content), then run it through the pure,
 * deterministic validator (validateBlueprint) which:
 *   - drops any block whose componentKey is NOT in the real component registry,
 *   - enforces 3..6 pages, home first, contact present, unique url-safe slugs,
 *   - guarantees every page's structural scaffold (navbar→hero→body→footer),
 *   - and, if the AI output is unusable, returns the DETERMINISTIC FALLBACK
 *     blueprint built from the industry template's defaultPages + componentPool
 *     (so generation NEVER dies — Bölüm 5 fallback principle).
 *
 * The Opus call shape mirrors htmlGenerate.ts EXACTLY:
 *   - model env ANTHROPIC_MODEL_WEBSITE_INITIAL (default claude-opus-4-8),
 *   - NO temperature / top_p / top_k / budget_tokens (Opus 4.8 → HTTP 400),
 *   - thinking:{type:'adaptive'}; output_config:{effort:'high'},
 *   - cache_control:{type:'ephemeral'} on the STABLE library-catalog system prefix.
 *
 * INJECTABLE for tests: generateSiteBlueprint accepts an optional `generate` fn
 * (like translateHtml's injectable translator) so the deterministic validator +
 * fallback can be exercised WITHOUT a live API call.
 */

import { getAnthropicClient, isAnthropicReady } from '@/lib/anthropic/client'
import { extractJsonObject } from '@/lib/anthropic/text'
import {
  COMPONENTS,
  listComponentKeys,
  getIndustryTemplate,
  INDUSTRY_TEMPLATES,
  type IndustryTemplate,
} from './library'
import type { CodegenContext, DesignSystem, SiteBlueprint } from './types'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import {
  validateBlueprint as _validateBlueprint,
  buildFallbackBlueprint as _buildFallbackBlueprint,
  isUsableBlueprint as _isUsableBlueprint,
  buildBlueprintSystemPrompt as _buildBlueprintSystemPrompt,
  buildBlueprintUserMessage as _buildBlueprintUserMessage,
} from './blueprintGeneratorShared.mjs'

type Registry = Record<string, unknown>
type Templates = Record<string, IndustryTemplate>
interface ValidateOpts {
  locale?: string
  industryTemplateKey?: string | null
  seed?: string | number
  /** #builder-6 — siteStyle → preferred hero key (HOME hero bias). */
  preferredHero?: string
}

const coreValidateBlueprint = _validateBlueprint as (
  raw: unknown,
  ds: DesignSystem,
  registry: Registry,
  templates: Templates,
  opts?: ValidateOpts,
) => SiteBlueprint
const coreBuildFallbackBlueprint = _buildFallbackBlueprint as (
  ds: DesignSystem,
  template: IndustryTemplate | undefined,
  registry: Registry,
  locale: string,
  seed: string | number,
  opts?: { preferredHero?: string },
) => SiteBlueprint
const coreIsUsableBlueprint = _isUsableBlueprint as (bp: unknown, registry: Registry) => boolean
const coreBuildBlueprintSystemPrompt = _buildBlueprintSystemPrompt as () => string
const coreBuildBlueprintUserMessage = _buildBlueprintUserMessage as (
  ctx: CodegenContext,
  template: IndustryTemplate | undefined,
  ds: DesignSystem,
  availableKeys: string[],
) => string

// ---------------------------------------------------------------------------
// Re-export the deterministic glue so app code (and the orchestrator) can import
// it from the .ts surface (the real implementations live in the .mjs).
// ---------------------------------------------------------------------------

/** Validate/coerce a blueprint to a VALID SiteBlueprint (fallback on unusable). */
export function validateBlueprint(
  raw: unknown,
  ds: DesignSystem,
  opts?: ValidateOpts,
): SiteBlueprint {
  return coreValidateBlueprint(raw, ds, COMPONENTS as unknown as Registry, INDUSTRY_TEMPLATES_MAP, opts)
}

/**
 * The deterministic fallback blueprint from an industry template (never empty).
 * #builder-6 — `preferredHero` (from the wizard siteStyle) biases the HOME hero.
 */
export function buildFallbackBlueprint(
  ds: DesignSystem,
  templateKey: string | null,
  locale: string,
  seed: string | number,
  preferredHero?: string,
): SiteBlueprint {
  const template = templateKey ? getIndustryTemplate(templateKey) : undefined
  return coreBuildFallbackBlueprint(
    ds, template, COMPONENTS as unknown as Registry, locale, seed,
    preferredHero ? { preferredHero } : undefined,
  )
}

/** True iff the blueprint is structurally usable against the real registry. */
export function isUsableBlueprint(bp: unknown): boolean {
  return coreIsUsableBlueprint(bp, COMPONENTS as unknown as Registry)
}

// The templates map (typed wrapper → the .mjs map) — ONE typed source for the
// validator + the fallback resolution.
const INDUSTRY_TEMPLATES_MAP = INDUSTRY_TEMPLATES as unknown as Templates

// ---------------------------------------------------------------------------
// Model constant — same env override + Opus 4.8 default as the rest of codegen.
// ---------------------------------------------------------------------------

const MODEL = process.env.ANTHROPIC_MODEL_WEBSITE_INITIAL ?? 'claude-opus-4-8'
const MAX_TOKENS = 8000

type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }

/**
 * An injectable raw-blueprint generator: takes (system, user) prompts and returns
 * the parsed JSON object (or null). Tests inject a pure fn; production uses the
 * real Opus call. Mirrors translateHtml's injectable translator pattern.
 */
export type BlueprintGenerateFn = (system: SystemBlock[], user: string) => Promise<unknown>

/**
 * The real Opus 4.8 blueprint generator. The STABLE system prefix (the library
 * catalog + composition rules) carries cache_control so repeated generations read
 * the cached prefix. NO temperature/top_p/top_k/budget_tokens.
 */
const opusGenerate: BlueprintGenerateFn = async (system, user) => {
  if (!isAnthropicReady()) {
    throw new Error('[blueprintGenerator] Anthropic not configured (ANTHROPIC_API_KEY missing)')
  }
  const client = getAnthropicClient()
  // CRITICAL: Do NOT add temperature, top_p, top_k, or budget_tokens.
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thinking: { type: 'adaptive' } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    output_config: { effort: 'high' } as any,
    system,
    messages: [{ role: 'user', content: user }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  let text: string | null = null
  for (const block of res.content) {
    if (block.type === 'text') text = (text ?? '') + block.text
  }
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
 * Generate a VALID SiteBlueprint for a site.
 *
 * Always returns a valid, bounded, self-consistent blueprint:
 *   - the AI output (if any) is validated/coerced against the real registry,
 *   - on no-key / call failure / parse failure / unusable output → the
 *     deterministic FALLBACK blueprint from the industry template.
 *
 * @param ctx              Stage-0 CodegenContext
 * @param ds               Stage-1 DesignSystem
 * @param industryTemplateKey chosen template key (e.g. 'otel') or null (free)
 * @param seed             per-site anti-clone seed (deterministic variety)
 * @param generate         optional injected generator (tests bypass the live call)
 */
export async function generateSiteBlueprint(
  ctx: CodegenContext,
  ds: DesignSystem,
  industryTemplateKey: string | null,
  seed: string | number,
  generate?: BlueprintGenerateFn,
): Promise<SiteBlueprint> {
  const template = industryTemplateKey ? getIndustryTemplate(industryTemplateKey) : undefined
  // #builder-6 — thread the siteStyle's preferred hero so BOTH the validator (AI
  // path) and the deterministic fallback bias the HOME hero toward the chosen tarz.
  const preferredHero = ctx.preferredHero || ''
  const opts: ValidateOpts = { locale: ctx.locale, industryTemplateKey, seed, preferredHero }

  // No injected fn + no live key → go straight to the deterministic fallback.
  if (!generate && !isAnthropicReady()) {
    console.warn('[blueprintGenerator] Anthropic not ready — using fallback blueprint')
    return coreBuildFallbackBlueprint(
      ds, template, COMPONENTS as unknown as Registry, ctx.locale, seed,
      preferredHero ? { preferredHero } : undefined,
    )
  }

  const gen = generate ?? opusGenerate
  // STABLE cached system prefix (library catalog + rules) + ephemeral cache_control.
  const system: SystemBlock[] = [
    { type: 'text', text: coreBuildBlueprintSystemPrompt(), cache_control: { type: 'ephemeral' } },
  ]
  const user = coreBuildBlueprintUserMessage(ctx, template, ds, listComponentKeys())

  let raw: unknown = null
  try {
    raw = await gen(system, user)
  } catch (e) {
    console.warn('[blueprintGenerator] soft-fail:', e instanceof Error ? e.message : e)
    raw = null
  }

  // validateBlueprint tolerates null/garbage → deterministic fallback if unusable.
  return coreValidateBlueprint(raw, ds, COMPONENTS as unknown as Registry, INDUSTRY_TEMPLATES_MAP, opts)
}
