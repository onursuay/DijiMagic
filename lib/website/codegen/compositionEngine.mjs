/**
 * lib/website/codegen/compositionEngine.mjs
 *
 * THE COMPOSITION ENGINE (Bölüm 4.8 / 5 of the master plan) — a PURE,
 * DETERMINISTIC layer that turns a validated SiteBlueprint into the final ordered
 * block plan, applying the anti-generic / anti-clone composition rules:
 *
 *   1. NO two CONSECUTIVE blocks share an `archetype` (the Stage-2 "ardışık
 *      arketip tekrarı yok" rule, carried here). When the blueprint would place
 *      two same-archetype blocks back-to-back we re-order (stable, deterministic)
 *      to break the run; if it cannot be broken we relabel the second block's
 *      archetype to a contrasting one (metadata only — the renderer reads it).
 *   2. SEED-DRIVEN VARIETY — `pickVariedSubset(pool, count, seed)` deterministically
 *      selects a varied subset of a component pool: same seed → same pick;
 *      different seed → a different pick. Two sites of the SAME industry therefore
 *      get DIFFERENT component/preset combinations (Bölüm 5.3 anti-clone).
 *   3. SECTION-RHYTHM / CONTRAST HINTS — each block gets `spacing` + `contrast`
 *      metadata (and a hero→next contrast flag) the renderer can use for vertical
 *      rhythm; this is additive content metadata, never a structural change.
 *
 * Pure ESM (no deps, no live API) so it is importable by BOTH the TS engine and
 * scripts/verify-website-codegen.mjs — mirroring components.mjs / multipagePlanShared.mjs.
 *
 * ANTI-CLONE SIGNATURE — `blueprintSignature(blueprint)` is a stable hash of
 * (componentKey+presetKey sequence across pages) + (palette + fonts). Two
 * blueprints with the same components/order/theme hash the same; any difference
 * (different seed-driven pick, different palette/font) hashes differently. Used by
 * the anti-clone check (Bölüm 5.5).
 */

// ---------------------------------------------------------------------------
// Deterministic PRNG — a tiny xorshift32 seeded from a string. Same seed string
// → same sequence. Used so "variety" is reproducible (testable) yet differs per
// seed. NOT cryptographic — purely for deterministic combinatorial variety.
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hash of a string → an unsigned 32-bit integer seed. */
export function hashString(str) {
  const s = str == null ? '' : String(str)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    // h *= 16777619, kept in 32-bit space via Math.imul.
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * A seeded deterministic RNG. Returns a function () → float in [0,1).
 * @param {string|number} seed
 */
export function makeRng(seed) {
  let state = (typeof seed === 'number' ? seed >>> 0 : hashString(seed)) || 0x9e3779b9
  // Ensure non-zero state (xorshift breaks on 0).
  if (state === 0) state = 0x9e3779b9
  return function next() {
    // xorshift32
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x100000000
  }
}

/**
 * Deterministically pick a VARIED subset of `pool` of size `count` driven by
 * `seed`. Same (pool, count, seed) → identical pick; a different seed → a
 * (typically) different pick. Preserves pool order within the picked set so the
 * result reads naturally. Never returns duplicates; `count` is clamped to the
 * pool size.
 *
 * @param {string[]} pool
 * @param {number} count
 * @param {string|number} seed
 * @returns {string[]}
 */
export function pickVariedSubset(pool, count, seed) {
  const arr = Array.isArray(pool) ? pool.filter((x) => typeof x === 'string' && x) : []
  const n = arr.length
  const want = Math.max(0, Math.min(Number.isFinite(count) ? Math.floor(count) : 0, n))
  if (want === 0) return []
  if (want === n) return arr.slice()

  const rng = makeRng(seed)
  // Fisher–Yates over an index array using the seeded RNG → a deterministic
  // permutation; take the first `want` indices, then re-sort to pool order.
  const idx = arr.map((_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = idx[i]
    idx[i] = idx[j]
    idx[j] = t
  }
  const chosen = idx.slice(0, want).sort((a, b) => a - b)
  return chosen.map((i) => arr[i])
}

/**
 * Deterministically pick ONE element of `pool` driven by `seed`. Same (pool, seed)
 * → identical pick; different seeds → (typically) different picks. Returns null on
 * an empty pool. Used to seed-vary single-slot choices (hero, navbar) so two sites
 * of the SAME industry differ — pure determinism, no Date/Math.random.
 *
 * @param {string[]} pool
 * @param {string|number} seed
 * @returns {string|null}
 */
export function pickSeededOne(pool, seed) {
  const arr = Array.isArray(pool) ? pool.filter((x) => typeof x === 'string' && x) : []
  if (arr.length === 0) return null
  if (arr.length === 1) return arr[0]
  const rng = makeRng(seed)
  const i = Math.floor(rng() * arr.length) % arr.length
  return arr[i]
}

/**
 * Deterministically pick a varied subset of `pool` of size `count` AND keep it in a
 * SEEDED ORDER (unlike pickVariedSubset, which re-sorts to pool order). Same
 * (pool, count, seed) → identical sequence; a different seed → a (typically)
 * different subset AND/OR order. This is what makes the fallback genuinely
 * seed-varied even when a page requests ALL of its (few) body candidates: the
 * ORDER still differs by seed → a different blueprintSignature.
 *
 * @param {string[]} pool
 * @param {number} count
 * @param {string|number} seed
 * @returns {string[]}
 */
export function pickVariedOrdered(pool, count, seed) {
  const arr = Array.isArray(pool) ? pool.filter((x) => typeof x === 'string' && x) : []
  const n = arr.length
  const want = Math.max(0, Math.min(Number.isFinite(count) ? Math.floor(count) : 0, n))
  if (want === 0) return []

  const rng = makeRng(seed)
  // Seeded Fisher–Yates permutation of the index array; take the first `want`
  // indices WITHOUT re-sorting → the order itself is seed-driven (variety).
  const idx = arr.map((_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = idx[i]
    idx[i] = idx[j]
    idx[j] = t
  }
  return idx.slice(0, want).map((i) => arr[i])
}

// ---------------------------------------------------------------------------
// Archetype inference + contrast — for the no-consecutive-archetype rule and the
// section-rhythm hints. Archetypes are coarse layout families; we infer one from
// a block's declared archetype, else from its componentKey.
// ---------------------------------------------------------------------------

/** Coarse archetype families (for contrast + the no-repeat rule). */
const ARCHETYPE_BY_KEY = {
  'navbar.standard': 'nav',
  'navbar.centered-logo': 'nav',
  'navbar.left-logo-right-cta': 'nav',
  'footer.standard': 'footer',
  'hero.minimal': 'centered-stack',
  'hero.split-image': 'asymmetric-split',
  'hero.full-background': 'full-bleed',
  'hero.service-business': 'asymmetric-split',
  'hero.corporate': 'editorial-stack',
  'hero.luxury': 'centered-stack',
  'services.grid': 'card-grid',
  'gallery.grid': 'mosaic-grid',
  'testimonials.cards': 'card-grid',
  'pricing-table.tiers': 'card-grid',
  'faq.accordion': 'list-stack',
  'cta.band': 'band',
  'contact-form.standard': 'form-stack',
}

/** Nav/footer component keys (pinned components — never moved by a swap). */
const NAV_KEYS = new Set(['navbar.standard', 'navbar.centered-logo', 'navbar.left-logo-right-cta'])
const FOOTER_KEY = 'footer.standard'

/** A contrasting archetype to break a forbidden consecutive run (metadata only). */
const CONTRAST_ARCHETYPE = {
  nav: 'nav',
  footer: 'footer',
  'centered-stack': 'asymmetric-split',
  'asymmetric-split': 'card-grid',
  'full-bleed': 'card-grid',
  'editorial-stack': 'card-grid',
  'card-grid': 'band',
  'mosaic-grid': 'band',
  'list-stack': 'card-grid',
  band: 'card-grid',
  'form-stack': 'card-grid',
}

/** Resolve a block's archetype: its declared one, else inferred from the key. */
export function archetypeOf(block) {
  if (block && typeof block.archetype === 'string' && block.archetype.trim()) {
    return block.archetype.trim()
  }
  const key = block && typeof block.componentKey === 'string' ? block.componentKey : ''
  return ARCHETYPE_BY_KEY[key] || 'section'
}

// ---------------------------------------------------------------------------
// Section-rhythm hints — alternate spacing density + surface contrast down the
// page so sections do not feel monotone. Pure function of (index, archetype).
// ---------------------------------------------------------------------------

/** Spacing density token (renderer maps to padding scale). */
function spacingFor(index, archetype) {
  if (archetype === 'nav' || archetype === 'footer') return 'edge'
  if (archetype === 'band') return 'tight'
  // Alternate roomy/standard down the body for rhythm.
  return index % 2 === 0 ? 'roomy' : 'standard'
}

/** Surface contrast token (renderer maps to bg treatment). */
function contrastFor(index, archetype, prevArchetype) {
  if (archetype === 'full-bleed' || archetype === 'band') return 'inverted'
  // A section right after the hero gets a contrast bump for separation.
  if (prevArchetype && (prevArchetype === 'full-bleed' || prevArchetype === 'centered-stack' || prevArchetype === 'asymmetric-split') && index <= 2) {
    return 'raised'
  }
  return index % 2 === 0 ? 'base' : 'raised'
}

// ---------------------------------------------------------------------------
// composeBlueprint — the main entry. Returns the ordered, anti-clone-rule-applied
// block sequence (one flat list per page in pages order), each block enriched
// with composition metadata. Deterministic: same (blueprint, seed) → identical out.
// ---------------------------------------------------------------------------

/**
 * Reorder a page's BODY blocks so no two CONSECUTIVE blocks share an archetype.
 * Navbar (first) + footer (last) are pinned; only the in-between body is shuffled
 * deterministically to break runs. If a run cannot be broken by reordering, the
 * offending block's archetype is RELABELLED to a contrasting one (metadata only).
 *
 * @param {Array} blocks blocks already in their intended order
 * @returns {Array} blocks with no consecutive archetype repeat
 */
function breakConsecutiveArchetypes(blocks) {
  const out = blocks.slice()
  const n = out.length
  if (n <= 1) return out

  // The nav (first) and footer (last) are PINNED: they must never be moved by a
  // swap (footer mid-page / nav mid-page would break the document structure). We
  // exclude any block whose archetype is 'nav'/'footer' (and the navbar/footer
  // components) as a swap CANDIDATE, and never move out[i] itself if it is nav/footer.
  const isPinned = (b) => {
    const a = archetypeOf(b)
    if (a === 'nav' || a === 'footer') return true
    const key = b && typeof b.componentKey === 'string' ? b.componentKey : ''
    return key === FOOTER_KEY || NAV_KEYS.has(key)
  }

  // Greedy stable pass: when out[i] and out[i-1] share an archetype, try to swap
  // out[i] with the nearest later NON-PINNED block whose archetype differs from
  // BOTH out[i-1] and (if present) out[i+1]. Nav stays first, footer stays last —
  // we explicitly skip pinned blocks as swap targets and never move out[i] if it
  // is pinned. If no valid non-nav/footer swap exists → relabel (invariant-safe).
  for (let i = 1; i < n; i++) {
    if (archetypeOf(out[i]) !== archetypeOf(out[i - 1])) continue
    if (isPinned(out[i])) continue // never move a pinned block (footer/nav)
    let swapped = false
    for (let j = i + 1; j < n; j++) {
      if (isPinned(out[j])) continue // never swap WITH a pinned block (footer/nav)
      const aj = archetypeOf(out[j])
      const afterOk = i + 1 >= n || aj !== archetypeOf(out[i + 1])
      if (aj !== archetypeOf(out[i - 1]) && afterOk) {
        const t = out[i]
        out[i] = out[j]
        out[j] = t
        swapped = true
        break
      }
    }
    if (!swapped) {
      // Could not reorder → relabel this block's archetype to a contrasting one.
      const prev = archetypeOf(out[i - 1])
      const contrast = CONTRAST_ARCHETYPE[prev] || 'section'
      // Avoid relabelling into the SAME as prev; if the map points back, nudge it.
      const finalArch = contrast === prev ? `${prev}-alt` : contrast
      out[i] = { ...out[i], archetype: finalArch }
    }
  }
  return out
}

/**
 * Compose a blueprint into the final ordered block plan with anti-clone rules.
 *
 * @param {import('./types').SiteBlueprint} blueprint  a VALID blueprint (run validateBlueprint first)
 * @param {import('./types').DesignSystem}  designSystem the site DesignSystem (used for rhythm; theme also in blueprint)
 * @param {string|number}                   seed       per-site seed (deterministic variety)
 * @returns {{ pages: Array<{ locale:string, slug:string, pageRole:string, orderIndex:number, blocks:Array }> }}
 */
export function composeBlueprint(blueprint, designSystem, seed) {
  const bp = blueprint && typeof blueprint === 'object' ? blueprint : { pages: [] }
  const pages = Array.isArray(bp.pages) ? bp.pages : []
  const baseSeed = seed == null ? 'seed' : seed

  const composedPages = pages.map((page, pageIdx) => {
    const rawBlocks = Array.isArray(page.blocks) ? page.blocks : []
    // Per-page seed mix so different pages vary independently yet deterministically.
    const pageSeed = `${baseSeed}::${page.slug || pageIdx}`

    // Apply the no-consecutive-archetype rule (reorder/relabel).
    const ordered = breakConsecutiveArchetypes(rawBlocks)

    // Enrich each block with composition metadata (spacing rhythm + contrast).
    let prevArch = ''
    const blocks = ordered.map((b, i) => {
      const arch = archetypeOf(b)
      const spacing = spacingFor(i, arch)
      const contrast = contrastFor(i, arch, prevArch)
      const heroToNext = i > 0 && (prevArch === 'full-bleed' || prevArch === 'centered-stack' || prevArch === 'asymmetric-split' || prevArch === 'editorial-stack')
      prevArch = arch
      return {
        id: typeof b.id === 'string' && b.id ? b.id : `b${i + 1}`,
        componentKey: b.componentKey,
        presetKey: typeof b.presetKey === 'string' && b.presetKey ? b.presetKey : presetFromKey(b.componentKey),
        archetype: arch,
        content: b.content && typeof b.content === 'object' ? b.content : {},
        // composition metadata (additive — renderer may use it for rhythm/contrast).
        composition: {
          order: i,
          spacing,
          contrast,
          heroToNextContrast: heroToNext,
          seed: hashString(`${pageSeed}::${i}`),
        },
      }
    })

    return {
      locale: page.locale,
      slug: page.slug,
      pageRole: page.pageRole,
      orderIndex: typeof page.orderIndex === 'number' ? page.orderIndex : pageIdx,
      blocks,
    }
  })

  // `designSystem` is read for forward-compat (rhythm could key off motion later);
  // referenced here so the param is not flagged unused.
  void designSystem

  return { pages: composedPages }
}

/** Default preset = the part of the componentKey after the first dot. */
function presetFromKey(componentKey) {
  if (typeof componentKey !== 'string') return 'default'
  const dot = componentKey.indexOf('.')
  return dot >= 0 ? componentKey.slice(dot + 1) : componentKey
}

// ---------------------------------------------------------------------------
// blueprintSignature — the ANTI-CLONE signature (Bölüm 5.5). A stable hash of:
//   (componentKey + presetKey sequence across ALL pages, in page+block order)
//   + (palette hex values + heading/body font families).
// Same composition + theme → same signature; any seed-driven pick change or
// palette/font change → different signature. Used to PROVE variety: same
// industry + two different seeds → DIFFERENT signatures.
// ---------------------------------------------------------------------------

/**
 * @param {import('./types').SiteBlueprint} blueprint
 * @returns {string} an 8-hex-char stable signature
 */
export function blueprintSignature(blueprint) {
  const bp = blueprint && typeof blueprint === 'object' ? blueprint : {}
  const pages = Array.isArray(bp.pages) ? bp.pages : []
  const parts = []

  // Component/preset sequence (the layout DNA).
  for (const page of pages) {
    parts.push(`#${page && page.slug ? page.slug : ''}`)
    const blocks = page && Array.isArray(page.blocks) ? page.blocks : []
    for (const b of blocks) {
      const ck = b && typeof b.componentKey === 'string' ? b.componentKey : ''
      const pk = b && typeof b.presetKey === 'string' && b.presetKey ? b.presetKey : presetFromKey(ck)
      parts.push(`${ck}:${pk}`)
    }
  }

  // Theme DNA (palette + fonts) — the other half of anti-clone.
  const ds = bp.designSystem && typeof bp.designSystem === 'object' ? bp.designSystem : {}
  const pal = ds.palette && typeof ds.palette === 'object' ? ds.palette : {}
  parts.push('@palette')
  for (const k of ['ink', 'accent', 'accentSoft', 'surface', 'onAccent', 'muted', 'border']) {
    parts.push(`${k}=${typeof pal[k] === 'string' ? pal[k] : ''}`)
  }
  const fonts = ds.fonts && typeof ds.fonts === 'object' ? ds.fonts : {}
  parts.push('@fonts')
  parts.push(`h=${typeof fonts.heading === 'string' ? fonts.heading : ''}`)
  parts.push(`b=${typeof fonts.body === 'string' ? fonts.body : ''}`)

  const h = hashString(parts.join('|'))
  return h.toString(16).padStart(8, '0')
}

/**
 * True iff NO two consecutive blocks on ANY page share an archetype (the invariant
 * composeBlueprint guarantees). Used by the verify script as a direct assertion.
 * @param {{ pages: Array }} composed result of composeBlueprint
 * @returns {boolean}
 */
export function hasNoConsecutiveArchetype(composed) {
  const pages = composed && Array.isArray(composed.pages) ? composed.pages : []
  for (const page of pages) {
    const blocks = Array.isArray(page.blocks) ? page.blocks : []
    for (let i = 1; i < blocks.length; i++) {
      if (archetypeOf(blocks[i]) === archetypeOf(blocks[i - 1])) return false
    }
  }
  return true
}
