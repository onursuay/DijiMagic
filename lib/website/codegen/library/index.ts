/**
 * lib/website/codegen/library/index.ts
 *
 * Thin TYPED wrapper around the Component Library (components.mjs).
 *
 * The registry + every deterministicRender (single source of truth) live in the
 * .mjs file so that:
 *   - scripts/verify-website-codegen.mjs can import it with plain Node (no TS build),
 *   - htmlGenerate / blockMap / blueprintGenerator import THIS file and get full types.
 *
 * Pattern mirrors renderGate.ts ↔ renderGate.mjs and assembleDocument.ts ↔ .mjs:
 * a STATIC literal import path './components.mjs' (the Turbopack rule — the bundler
 * resolves the .mjs at runtime; the import is type-erased here).
 *
 * HİBRİT note: this is the library LAYER. The free-form HTML engine
 * (htmlGenerateShared.mjs) is unchanged. A ComponentDef's deterministicRender
 * produces an HTML STRING that flows through the EXISTING pipeline (sanitize →
 * renderGate → assembleDocument) — these are NOT React components.
 */

import type { DesignSystem } from '../types'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js/Turbopack resolves it fine at runtime
import {
  COMPONENTS as _COMPONENTS,
  getComponent as _getComponent,
  renderComponent as _renderComponent,
  listComponents as _listComponents,
  listComponentKeys as _listComponentKeys,
  esc as _esc,
} from './components.mjs'

// ---------------------------------------------------------------------------
// Types — the ComponentDef contract (plain descriptor, NO Zod — dependency-free).
// ---------------------------------------------------------------------------

/** Editable content field kinds (visual-edit / chat-patch contract, Bölüm 4.5). */
export type ContentFieldType = 'text' | 'richtext' | 'image' | 'href' | 'list'

/**
 * The shape of ONE item inside a `list` field (e.g. each menu link, each
 * service card). Keeps the visual-edit inspector aware of the per-item editable
 * sub-fields. Plain descriptor — same dependency-free contract as ContentField.
 */
export interface ListItemField {
  /** Key the renderer reads on each list item (e.g. 'label', 'title'). */
  name: string
  /** Field kind for the sub-field. */
  type: ContentFieldType
  /** Human label (TR) for the inspector. */
  label: string
}

/** A single editable field descriptor for a component's content. */
export interface ContentField {
  /** Content key the deterministicRender reads (e.g. 'heading'). */
  name: string
  /** Field kind — drives the inspector widget + light validation. */
  type: ContentFieldType
  /** Whether the field must be present for a well-formed render. */
  required: boolean
  /** Human label (TR) for the visual-edit inspector. */
  label: string
  /**
   * For `type: 'list'` — the editable shape of each item (sub-fields the
   * renderer reads off every element). Omit for non-list fields.
   */
  item?: ListItemField[]
  /**
   * `false` marks an intentional, NON-inspector style/behaviour override the
   * renderer reads but that should NOT appear as an editable field (e.g. a quiet
   * label override). Default (absent) → editable. Declared so the
   * contentFields-completeness contract still covers every key the renderer reads.
   */
  editable?: boolean
}

/** Components gated behind extra credit / a higher plan (Bölüm 5.6). */
export type ComponentTier = 'extra_credit' | 'pro'

/** Options passed to deterministicRender (sequential id + per-site choices). */
export interface RenderOpts {
  /** data-yoai-id value for the block's top-level element (e.g. 'b1'). */
  id?: string
  /** Mobile-menu slide direction (navbar) — wizard choice; default 'left'. */
  mobileMenuAnim?: 'left' | 'right' | 'top'
}

/**
 * A library component definition. `deterministicRender` is BOTH the canonical
 * render for fixed components (navbar/footer/contact-form) AND the fallback when
 * the AI free-form path is unavailable or the gate rejects.
 */
export interface ComponentDef {
  /** Registry key → data-yoai-block value (e.g. 'navbar.standard'). */
  key: string
  /** Coarse grouping for the prompt/inspector (navigation, hero, content, …). */
  category: string
  /** Semantic landmark tag the top-level element uses. */
  blockTag: 'header' | 'footer' | 'nav' | 'section'
  /** Editable content fields (visual-edit + chat-patch contract). */
  contentFields: ContentField[]
  /** Anti-generic composition directive injected into the AI prompt layer. */
  promptHint: string
  /** Produce the block's HTML string (var-token themed, data-yoai-* tagged). */
  deterministicRender: (
    content: Record<string, unknown>,
    ds: DesignSystem,
    opts?: RenderOpts,
  ) => string
  /** Optional paywall tier (Bölüm 5.6). */
  requiresTier?: ComponentTier
}

// ---------------------------------------------------------------------------
// Typed re-exports.
// ---------------------------------------------------------------------------

/** The full registry, keyed by ComponentDef.key. */
export const COMPONENTS: Record<string, ComponentDef> = _COMPONENTS as Record<string, ComponentDef>

/** Look up a ComponentDef by key (undefined if unknown). */
export const getComponent: (key: string) => ComponentDef | undefined =
  _getComponent as (key: string) => ComponentDef | undefined

/** All registered component keys, in registry order. */
export const listComponentKeys: () => string[] = _listComponentKeys as () => string[]

/**
 * List ComponentDefs, optionally filtered by category.
 * @param category omit/empty → every component.
 */
export const listComponents: (category?: string) => ComponentDef[] =
  _listComponents as (category?: string) => ComponentDef[]

/**
 * Render a component to an HTML string. Unknown key → '' (caller falls back to
 * the free-form engine). The output is var-token themed, carries data-yoai-block
 * + data-yoai-id, and is safe to flow through the existing sanitize → gate pipeline.
 */
export const renderComponent: (
  key: string,
  content: Record<string, unknown>,
  ds: DesignSystem,
  opts?: RenderOpts,
) => string = _renderComponent as (
  key: string,
  content: Record<string, unknown>,
  ds: DesignSystem,
  opts?: RenderOpts,
) => string

/** HTML-escape helper (shared with the renderers). */
export const esc: (value: unknown) => string = _esc as (value: unknown) => string

// ---------------------------------------------------------------------------
// Industry templates (Bölüm 4.3) — typed wrapper over industryTemplates.mjs.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js/Turbopack resolves it fine at runtime
import {
  INDUSTRY_TEMPLATES as _INDUSTRY_TEMPLATES,
  SHARED_POOLS as _SHARED_POOLS,
  listIndustryTemplateKeys as _listIndustryTemplateKeys,
  getIndustryTemplate as _getIndustryTemplate,
  allPooledComponentKeys as _allPooledComponentKeys,
} from './industryTemplates.mjs'

/** A booking shape a template leans on (mock flows — Bölüm 4.6). */
export type BookingMode = 'reservation' | 'ticket' | 'none'
/** A commerce shape a template leans on (mock flows — Bölüm 4.6). */
export type CommerceMode = 'ecommerce' | 'none'

/**
 * An industry template — a page-plan SKELETON + a per-page component POOL +
 * optional token hints. NOT fixed content; the composition engine picks a varied
 * subset from each pool (seed-driven) → anti-clone.
 */
export interface IndustryTemplate {
  /** Template key (e.g. 'otel'). */
  key: string
  /** Recommended PageRole set (home first, contact present). */
  defaultPages: string[]
  /** Per PageRole, a POOL of EXISTING registry component keys to pick from. */
  componentPool: Record<string, string[]>
  /** Optional palette/font/spacing hints (NOT mandatory — DesignSystem owns the real tokens). */
  tokenSuggestions: Partial<DesignSystem>
  /** The sector's booking shape (mock). */
  bookingMode?: BookingMode
  /** The sector's commerce shape (mock). */
  commerceMode?: CommerceMode
}

/** The full industry-template registry, keyed by template key. */
export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> =
  _INDUSTRY_TEMPLATES as Record<string, IndustryTemplate>

/** Scaffolding pools shared across templates (navbar / footer / contact slots). */
export const SHARED_POOLS: Record<'nav' | 'footer' | 'contact', string[]> =
  _SHARED_POOLS as Record<'nav' | 'footer' | 'contact', string[]>

/** All registered industry template keys, in registry order. */
export const listIndustryTemplateKeys: () => string[] =
  _listIndustryTemplateKeys as () => string[]

/** Look up an IndustryTemplate by key (undefined if unknown). */
export const getIndustryTemplate: (key: string) => IndustryTemplate | undefined =
  _getIndustryTemplate as (key: string) => IndustryTemplate | undefined

/** Every distinct component key referenced by any template's componentPool. */
export const allPooledComponentKeys: () => string[] =
  _allPooledComponentKeys as () => string[]
