import 'server-only'
/**
 * lib/website/codegen/translateHtml.ts
 *
 * Thin `.ts` surface over the shared structure-preserving translation core
 * (translateHtml.mjs). The core is pure + injectable; THIS file wires the real
 * Sonnet (claude-sonnet-4-6, the cheaper model) translator and re-exports the
 * structure-preserving translate functions for the orchestrator.
 *
 * Same SDK shape as brandSynthesis.ts: getAnthropicClient().messages.create with
 * NO temperature / top_p / budget_tokens. Translation is best-effort — the caller
 * (generateHtmlSite) catches a throw and falls back to the default-locale html.
 */

import { getAnthropicClient, isAnthropicReady } from '@/lib/anthropic/client'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import {
  translatePageHtml as _translatePageHtml,
  translateStrings as _translateStrings,
  buildTranslationPrompt as _buildTranslationPrompt,
  parseTranslationArray as _parseTranslationArray,
} from './translateHtml.mjs'

type Translator = (strings: string[]) => Promise<string[]>

const coreTranslatePageHtml = _translatePageHtml as (
  html: string,
  fromLocale: string,
  toLocale: string,
  translator: Translator,
) => Promise<string>
const coreTranslateStrings = _translateStrings as (
  strings: string[],
  translator: Translator,
) => Promise<string[]>
const coreBuildTranslationPrompt = _buildTranslationPrompt as (
  fromLocale: string,
  toLocale: string,
  strings: string[],
) => { system: string; user: string }
const coreParseTranslationArray = _parseTranslationArray as (text: string | null) => string[] | null

// Cheaper, fast model for translation (NOT Opus — translation is structure-preserving
// and does not need the generation model). Override via env if needed.
const TRANSLATION_MODEL = process.env.ANTHROPIC_MODEL_WEBSITE_TRANSLATE ?? 'claude-sonnet-4-6'
const TRANSLATION_MAX_TOKENS = 8000

/**
 * Build the real Sonnet-backed translator. One translation call per string batch.
 * Throws on no-key / call failure / parse-or-length miss so the core throws too →
 * the orchestrator falls back to the original html for that page+locale.
 */
function makeSonnetTranslator(fromLocale: string, toLocale: string): Translator {
  return async (strings: string[]): Promise<string[]> => {
    if (!isAnthropicReady()) {
      throw new Error('[translateHtml] Anthropic not configured (ANTHROPIC_API_KEY missing)')
    }
    const { system, user } = coreBuildTranslationPrompt(fromLocale, toLocale, strings)
    const client = getAnthropicClient()
    // CRITICAL: no temperature / top_p / budget_tokens (mirror brandSynthesis.ts).
    const res = await client.messages.create({
      model: TRANSLATION_MODEL,
      max_tokens: TRANSLATION_MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    })
    let text: string | null = null
    for (const block of res.content) {
      if (block.type === 'text') text = (text ?? '') + block.text
    }
    const arr = coreParseTranslationArray(text)
    if (!arr || arr.length !== strings.length) {
      throw new Error(
        `[translateHtml] Sonnet returned ${arr ? `${arr.length} items` : 'unparseable output'}, expected ${strings.length}`,
      )
    }
    return arr
  }
}

/**
 * Translate a page's body HTML from `fromLocale` to `toLocale`, preserving HTML
 * structure / classes / data-* / hrefs / images. Real Sonnet call unless a
 * translator is injected (tests). Throws on any miss → caller falls back.
 */
export async function translatePageHtml(
  html: string,
  fromLocale: string,
  toLocale: string,
  translator?: Translator,
): Promise<string> {
  return coreTranslatePageHtml(html, fromLocale, toLocale, translator ?? makeSonnetTranslator(fromLocale, toLocale))
}

/**
 * Translate a small batch of plain strings (SEO title/description). Same throw
 * contract as translatePageHtml so the caller falls back identically.
 */
export async function translateStrings(
  strings: string[],
  fromLocale: string,
  toLocale: string,
  translator?: Translator,
): Promise<string[]> {
  return coreTranslateStrings(strings, translator ?? makeSonnetTranslator(fromLocale, toLocale))
}
