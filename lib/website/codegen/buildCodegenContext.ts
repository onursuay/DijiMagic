import 'server-only'
/**
 * lib/website/codegen/buildCodegenContext.ts
 *
 * Stage 0 of the new code-generation pipeline.
 * Gathers brand/site context and quarantines ALL untrusted external text
 * against prompt injection before passing it to the AI.
 *
 * ── Scoping / cross-business-leak prevention ──────────────────────────────
 * CLAUDE.md "SEO Makale Üretimi — Bağlam Kapsamı" documents a KRİTİK class
 * of cross-business leaks: the legacy generate.ts always calls
 * getProfileByUserId / getIntelligenceByUserId (global, userId-scoped),
 * which can leak a DIFFERENT business's brand text when a multi-business user
 * (DIJIMAGIC_PER_ACCOUNT_SCOPE) has an unrelated business as their global profile.
 *
 * This module applies the correct scoping rule (see buildCodegenContext below):
 *   PRIMARY  → site-scoped referenceUrls scrape content (this site's own URLs)
 *   FALLBACK → global profile/intelligence, only when the site has no usable
 *              reference-URL scrape content.
 *
 * ── Quarantine ────────────────────────────────────────────────────────────
 * Any external text (profile, intelligence, reference-URL scrape summaries)
 * is wrapped via wrapUntrusted() — imported from untrusted.mjs so the pure
 * function can also be tested from the .mjs verify script without a build step.
 *
 * The user's initialInstructions is kept SEPARATE in `instruction` — it is
 * a trusted-ish channel (the user's own intent), not wrapped as untrusted.
 */

import { getProfileByUserId, getIntelligenceByUserId } from '@/lib/dijimagic/businessProfileStore'
import { scanReferences } from '@/lib/website/referenceScanner'
import { styleDirective } from '@/lib/website/render/theme'
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
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import { resolveSourceUsage, buildReferenceDirective } from './sourcePriority.mjs'

type SourceUsage = {
  useReference: boolean
  useProfile: boolean
  resolved: 'reference' | 'manual' | 'auto'
  note: string
}
const coreResolveSourceUsage = resolveSourceUsage as (
  priority: 'reference' | 'manual' | null | undefined,
  hasReferenceContent: boolean,
) => SourceUsage
const coreBuildReferenceDirective = buildReferenceDirective as (
  resolved: 'reference' | 'manual' | 'auto',
  hasReferenceContent: boolean,
  locale?: string,
) => string

const clean = (s: string | null | undefined): string =>
  typeof s === 'string' ? s.trim() : ''

/**
 * Coerce a stored mobile-menu animation choice to a known value.
 * Any unknown/absent value (backward-compat: older sites have no field) → 'left'.
 */
function coerceMobileMenuAnim(v: unknown): 'left' | 'right' | 'top' {
  return v === 'right' || v === 'top' ? v : 'left'
}

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
 * ── Source priority (cross-business-leak prevention) ─────────────────────
 * CLAUDE.md "SEO Makale Üretimi — Bağlam Kapsamı" documents a KRİTİK class
 * of cross-business leak bugs: when a multi-business user (DIJIMAGIC_PER_ACCOUNT_SCOPE)
 * has a DIFFERENT business registered as their global profile, global
 * getProfileByUserId / getIntelligenceByUserId would leak that other business's
 * brand text into THIS site's generation context.
 *
 * Rule applied here:
 *   PRIMARY   — site-specific brand text: scanned referenceUrls content (scraped
 *               directly from this site's own URLs, so always site-scoped).
 *   FALLBACK  — global profile/intelligence (userId-scoped, potentially a
 *               different business) — only when the site has NO usable reference-
 *               URL scrape content (refSummaries is empty or all-blank).
 *
 * Signal used: `refSummaries.some(s => s.trim())` — at least one non-blank
 * reference-URL scrape block means we have site-specific brand content.
 *
 * ── Other fields ──────────────────────────────────────────────────────────
 *   - Site-specific fields: website.theme (style, fontHref, logoUrl,
 *                           referenceUrls, initialInstructions)
 *   - Locale:               website.defaultLocale
 *
 * External sources are wrapped in wrapUntrusted(). User instruction is separate.
 */
/**
 * Optional revise controls threaded from the generate route.
 * When `instructions` is non-empty it OVERRIDES theme.initialInstructions as the
 * prompt instruction so a revise visibly changes the site. Empty/absent → identical
 * to initial generation (uses initialInstructions). `revisionMode` is accepted for
 * future targeted-patch phases; today the instruction text alone reaches the prompt.
 */
export interface BuildCodegenContextOptions {
  instructions?: string
  revisionMode?: 'edit' | 'reject'
}

export async function buildCodegenContext(
  userId: string,
  website: Website,
  opts?: BuildCodegenContextOptions,
): Promise<CodegenContext> {
  const theme = website.theme ?? {}

  // ── Veri önceliği (data-source priority) — FUNCTIONAL toggle ───────────
  // The wizard's "Veri Önceliği" choice decides which source is authoritative.
  // null/undefined → AUTO (legacy): reference-content-if-present-else-profile.
  const dataSourcePriority = theme.dataSourcePriority ?? null

  // Reference-URL scrape summaries — SITE-SCOPED (scraped from this site's own URLs).
  // For 'manual' priority we still skip the (potentially slow) scan entirely:
  // reference content is ignored for content there, so scanning would be wasted work.
  const referenceUrls = theme.referenceUrls ?? []
  const refSummaries: string[] =
    dataSourcePriority !== 'manual' && referenceUrls.length
      ? await scanReferences(referenceUrls)
      : []

  // Does this site have usable site-specific reference content?
  // At least one non-blank reference-URL block = the reference can speak for itself.
  const hasReferenceContent = refSummaries.some((s) => s.trim())

  // Decide, via the pure helper, which sources actually drive generation:
  //   'reference' → reference authoritative, profile NOT pulled (even if thin)
  //   'manual'    → profile authoritative, reference NOT injected
  //   auto/null   → reference-if-present-else-profile (unchanged legacy behavior)
  // The verify script asserts every branch of resolveSourceUsage.
  const usage = coreResolveSourceUsage(dataSourcePriority, hasReferenceContent)
  if (usage.note) console.warn('[buildCodegenContext] source-priority:', usage.note)

  // ── Global profile / intelligence ──────────────────────────────────────
  // Fetched ONLY when usage.useProfile is true:
  //   - 'manual' priority (profile is authoritative), or
  //   - auto + NO reference content (last-resort fallback).
  // Skipped for 'reference' priority (and for auto-with-reference) to prevent
  // cross-business brand leak (CLAUDE.md: "SEO Makale Üretimi — Bağlam Kapsamı / KRİTİK").
  const [profile, intelligence] = usage.useProfile
    ? await Promise.all([
        getProfileByUserId(userId),
        getIntelligenceByUserId(userId),
      ])
    : [null, null]

  // ── Trusted instruction (user's own intent) ────────────────────────────
  // Revize talimatı (opts.instructions) varsa initialInstructions'ın ÖNÜNE geçer →
  // kullanıcının düzeltme/red isteği üretime yansır (legacy revisionMode paritesi).
  // Boş/yok → ilk üretim davranışı: initialInstructions kullanılır.
  const instruction = clean(opts?.instructions) || clean(theme.initialInstructions)

  // ── Brand name ─────────────────────────────────────────────────────────
  // Prefer site label > profile company name (global fallback) > generic
  const brandName =
    clean(website.label) ||
    clean(profile?.company_name) ||
    (website.defaultLocale === 'en' ? 'Your Brand' : 'Markanız')

  // ── Untrusted blocks (external, attacker-influenceable text) ───────────
  const untrustedBlocks: string[] = []

  // Global profile/intelligence blocks — only present when used as fallback
  const profileText = summariseProfile(profile)
  if (profileText) {
    untrustedBlocks.push(wrapUntrusted('brand_profile', profileText))
  }

  const intelText = summariseIntelligence(intelligence)
  if (intelText) {
    untrustedBlocks.push(wrapUntrusted('brand_intelligence', intelText))
  }

  // Site-specific reference-URL scrape blocks (always site-scoped) — injected
  // ONLY when usage.useReference is true ('reference' priority, or auto-with-content).
  // For 'manual' priority these are intentionally NOT injected (refUrls ignored).
  if (usage.useReference) {
    refSummaries.forEach((summary, idx) => {
      if (summary.trim()) {
        untrustedBlocks.push(wrapUntrusted(`reference_url_${idx + 1}`, summary))
      }
    })
  }

  // ── Trusted reference-priority directive ────────────────────────────────
  // When priority='reference', thread a directive telling the model to derive the
  // PAGE SET + content FROM the reference site (so multipage plan + per-page copy
  // genuinely reflect it). Empty for 'manual'/auto → those prompts are unchanged.
  const referenceDirective = coreBuildReferenceDirective(
    usage.resolved,
    hasReferenceContent,
    website.defaultLocale,
  )

  // ── Zengin tarz direktifi (theme.ts) ───────────────────────────────────
  // `style` çıplak anahtar kelimedir ("modern"); styleDirective o tarzın AI'a
  // verilecek tam ton/hareket yönergesini döndürür. "modern" → animasyonlu/
  // kinetik/dinamik. Bilinmeyen/boş style → '' (prompt builder çıplak style'a düşer).
  const richStyleDirective = styleDirective(theme.style)

  return {
    brandName,
    locale: website.defaultLocale,
    style: theme.style ?? undefined,
    styleDirective: richStyleDirective || undefined,
    fontHref: theme.fontHref ?? null,
    logoUrl: theme.logoUrl ?? null,
    // Mobil menü animasyon seçimi (sihirbazda seçilir) — geçersiz/yok → 'left'.
    mobileMenuAnim: coerceMobileMenuAnim(theme.mobileMenuAnim),
    instruction,
    untrustedBlocks,
    referenceDirective: referenceDirective || undefined,
  }
}
