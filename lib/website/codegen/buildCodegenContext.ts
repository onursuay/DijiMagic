import 'server-only'
/**
 * lib/website/codegen/buildCodegenContext.ts
 *
 * Stage 0 of the new code-generation pipeline.
 * Gathers brand/site context and quarantines ALL untrusted external text
 * against prompt injection before passing it to the AI.
 *
 * ── Scoping / cross-business-leak prevention ──────────────────────────────
 * generate.ts (the legacy engine at lib/website/ai/generate.ts) calls:
 *
 *   const [profile, intelligence] = await Promise.all([
 *     getProfileByUserId(user.id),
 *     getIntelligenceByUserId(user.id),
 *   ])
 *
 * and then reads site-specific fields from `site.theme` (style, fontHref,
 * logoUrl, referenceUrls, initialInstructions). There is no per-site profile
 * scoping in the existing engine — it always uses the single global profile
 * tied to the userId.
 *
 * We replicate exactly that behaviour here (no regression, no improvement).
 * The CLAUDE.md note about cross-business leakage applies to the SEO module
 * (topicSelector.ts), which does use siteConnectionId scoping. The website
 * generator has always used the global profile; we mirror that and document
 * the finding in the task report.
 *
 * ── Quarantine ────────────────────────────────────────────────────────────
 * Any external text (profile, intelligence, reference-URL scrape summaries)
 * is wrapped via wrapUntrusted() — imported from untrusted.mjs so the pure
 * function can also be tested from the .mjs verify script without a build step.
 *
 * The user's initialInstructions is kept SEPARATE in `instruction` — it is
 * a trusted-ish channel (the user's own intent), not wrapped as untrusted.
 */

import { getProfileByUserId, getIntelligenceByUserId } from '@/lib/yoai/businessProfileStore'
import { scanReferences } from '@/lib/website/referenceScanner'
import type { Website } from '@/lib/website/types'
import type { CodegenContext } from './types'
// Pure ESM helper shared with .mjs verify — import as a module alias
// TypeScript will resolve the .mjs file through the path mapping.
// We use a dynamic require-style import via createRequire in .mjs, but here
// in TS we import the functions directly using their JS module path.
// Since .mjs isn't a TS file, we declare the module inline below.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import { wrapUntrusted } from './untrusted.mjs'

const clean = (s: string | null | undefined): string =>
  typeof s === 'string' ? s.trim() : ''

/**
 * Summarise a BusinessProfileRow into a compact text block for the AI.
 * Only includes fields that are present.
 */
function summariseProfile(profile: Awaited<ReturnType<typeof getProfileByUserId>>): string {
  if (!profile) return ''
  const lines: string[] = []
  const add = (k: string, v: string | string[] | null | undefined) => {
    const val = Array.isArray(v) ? v.filter(Boolean).join(', ') : clean(v as string)
    if (val) lines.push(`${k}: ${val}`)
  }
  add('Firma', profile.company_name)
  add('Sektör', [profile.sector_main, profile.sector_sub].filter(Boolean).join(' / '))
  add('Uzmanlık', profile.specialization)
  add('Açıklama', profile.business_description)
  add('Ürün/Hizmetler', profile.products_or_services)
  add('Hedef kitle', profile.target_audience)
  add('Lokasyonlar', profile.target_locations)
  add('Marka tonu', profile.brand_tone)
  add('Anahtar kelimeler', profile.keywords)
  if (profile.forbidden_claims?.length) {
    lines.push(`YASAK iddialar: ${profile.forbidden_claims.join(', ')}`)
  }
  return lines.join('\n')
}

/**
 * Summarise a BusinessIntelligenceRow into a compact text block.
 */
function summariseIntelligence(
  intelligence: Awaited<ReturnType<typeof getIntelligenceByUserId>>,
): string {
  if (!intelligence) return ''
  const lines: string[] = []
  const add = (k: string, v: string | null | undefined) => {
    const val = clean(v)
    if (val) lines.push(`${k}: ${val}`)
  }
  add('Şirket özeti', intelligence.company_summary)

  // ai_synthesis sub-object (typed loosely in the store as unknown JSON)
  type Synthesis = {
    brand_voice?: string | null
    value_proposition?: string | null
    messaging_pillars?: string[]
    differentiators?: string[]
    suggested_keywords?: string[]
    tone_guidance?: string | null
  }
  const ai = (intelligence as unknown as { ai_synthesis?: Synthesis }).ai_synthesis ?? {}
  add('Marka sesi', ai.brand_voice)
  add('Değer önerisi', ai.value_proposition)
  const arr = (v: string[] | undefined) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : '')
  const pillars = arr(ai.messaging_pillars)
  if (pillars) lines.push(`Mesaj sütunları: ${pillars}`)
  const diff = arr(ai.differentiators)
  if (diff) lines.push(`Farklılaştırıcılar: ${diff}`)
  add('Ton rehberi', ai.tone_guidance)
  return lines.join('\n')
}

/**
 * Build the Stage-0 CodegenContext.
 *
 * Mirrors generate.ts data access exactly:
 *   - Profile + intelligence: global getProfileByUserId / getIntelligenceByUserId (userId-scoped)
 *   - Site-specific fields:   website.theme (style, fontHref, logoUrl, referenceUrls, initialInstructions)
 *   - Locale:                 website.defaultLocale
 *
 * External sources are wrapped in wrapUntrusted(). User instruction is separate.
 */
export async function buildCodegenContext(
  userId: string,
  website: Website,
): Promise<CodegenContext> {
  const theme = website.theme ?? {}

  // ── Data access (mirrors generate.ts exactly) ──────────────────────────
  const [profile, intelligence] = await Promise.all([
    getProfileByUserId(userId),
    getIntelligenceByUserId(userId),
  ])

  // Reference-URL scrape summaries (same call generate.ts makes)
  const referenceUrls = theme.referenceUrls ?? []
  const refSummaries: string[] = referenceUrls.length
    ? await scanReferences(referenceUrls)
    : []

  // ── Trusted instruction (user's own intent) ────────────────────────────
  const instruction = clean(theme.initialInstructions)

  // ── Brand name ─────────────────────────────────────────────────────────
  // Prefer site label > profile company name > generic fallback
  const brandName =
    clean(website.label) ||
    clean(profile?.company_name) ||
    (website.defaultLocale === 'en' ? 'Your Brand' : 'Markanız')

  // ── Untrusted blocks (external, attacker-influenceable text) ───────────
  const untrustedBlocks: string[] = []

  const profileText = summariseProfile(profile)
  if (profileText) {
    untrustedBlocks.push(wrapUntrusted('brand_profile', profileText))
  }

  const intelText = summariseIntelligence(intelligence)
  if (intelText) {
    untrustedBlocks.push(wrapUntrusted('brand_intelligence', intelText))
  }

  refSummaries.forEach((summary, idx) => {
    if (summary.trim()) {
      untrustedBlocks.push(wrapUntrusted(`reference_url_${idx + 1}`, summary))
    }
  })

  return {
    brandName,
    locale: website.defaultLocale,
    style: theme.style ?? undefined,
    fontHref: theme.fontHref ?? null,
    logoUrl: theme.logoUrl ?? null,
    instruction,
    untrustedBlocks,
  }
}
