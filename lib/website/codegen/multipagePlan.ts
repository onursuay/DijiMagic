import 'server-only'
/**
 * lib/website/codegen/multipagePlan.ts
 *
 * MULTIPAGE Stage-2: PAGE PLANNING (one Opus 4.8 call).
 *
 * Given the Stage-0 CodegenContext, ask Opus to produce a SITEMAP — a small list
 * of business-appropriate pages ({ slug, title, navLabel, role, purpose }) — then
 * run it through the pure validator (validatePagePlan) which:
 *   - forces a home page first (slug 'home', role 'home'),
 *   - guarantees a contact page,
 *   - keeps 3..6 pages, unique url-safe slugs, sequential orderIndex.
 *
 * Soft-fail: on no-key / call failure / parse failure, returns a deterministic
 * default plan (home + Hakkımızda + İletişim) via validatePagePlan(null, locale),
 * so the multipage flow never hard-crashes on the planning step alone. (The
 * orchestrator still gates each generated page and can fail the whole run.)
 *
 * Opus constraints (same as the rest): NO temperature/top_p/top_k/budget_tokens;
 * adaptive thinking; effort high; tolerant JSON parse + strict list validation.
 */

import { getAnthropicClient, isAnthropicReady } from '@/lib/anthropic/client'
import { extractJsonObject } from '@/lib/anthropic/text'
import type { CodegenContext } from './types'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import {
  validatePagePlan as _validatePagePlan,
  buildPlanSystemPrompt as _buildPlanSystemPrompt,
  buildPlanUserMessage as _buildPlanUserMessage,
} from './multipagePlanShared.mjs'

/** A planned page in the sitemap. */
export interface PlannedPage {
  slug: string
  title: string
  navLabel: string
  role: string
  purpose: string
  orderIndex: number
}

const coreValidatePagePlan = _validatePagePlan as (raw: unknown, locale: string) => PlannedPage[]
const coreBuildPlanSystemPrompt = _buildPlanSystemPrompt as () => string
const coreBuildPlanUserMessage = _buildPlanUserMessage as (ctx: CodegenContext) => string

const MODEL = process.env.ANTHROPIC_MODEL_WEBSITE_INITIAL ?? 'claude-opus-4-8'

function parsePlanText(text: string | null): unknown {
  if (!text) return null
  try {
    return JSON.parse(extractJsonObject(text))
  } catch {
    return null
  }
}

/**
 * Plan the sitemap for a multipage site. Always returns a valid, bounded,
 * self-consistent page list (3..6 pages, home first, contact present).
 *
 * @param ctx Stage-0 CodegenContext (brand/description/category/reference content)
 * @returns the validated PlannedPage[] (home is index 0)
 */
export async function planSitePages(ctx: CodegenContext): Promise<PlannedPage[]> {
  if (!isAnthropicReady()) {
    console.warn('[multipagePlan] Anthropic not ready — using default plan')
    return coreValidatePagePlan(null, ctx.locale)
  }

  try {
    const client = getAnthropicClient()

    // CRITICAL: Do NOT add temperature, top_p, top_k, or budget_tokens.
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinking: { type: 'adaptive' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output_config: { effort: 'high' } as any,
      system: coreBuildPlanSystemPrompt(),
      messages: [{ role: 'user', content: coreBuildPlanUserMessage(ctx) }],
    })

    let text: string | null = null
    for (const block of res.content) {
      if (block.type === 'text') {
        text = block.text
        break
      }
    }

    const raw = parsePlanText(text)
    // validatePagePlan tolerates null/garbage → deterministic default plan.
    return coreValidatePagePlan(raw, ctx.locale)
  } catch (e) {
    console.warn('[multipagePlan] soft-fail:', e instanceof Error ? e.message : e)
    return coreValidatePagePlan(null, ctx.locale)
  }
}
