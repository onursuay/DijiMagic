/**
 * lib/website/creditBreakdown.mjs
 *
 * PURE breakdown math for the step-by-step credit TELEMETRY (#builder-5b).
 *
 * The route makes exactly ONE real charge (chargeFeature → credit_transactions —
 * the atomic ledger, UNCHANGED). This helper splits that single charged `total`
 * across the phases that actually ran (designSystem, blueprint, render, images,
 * translate, publish) so the CreditUsageTimeline UI can show a phase-by-phase
 * breakdown. It is DISPLAY telemetry only — it NEVER spends credits.
 *
 * INVARIANT (asserted in scripts/verify-website-codegen.mjs): the per-phase
 * credit_delta values SUM EXACTLY to the charged `total`. No double-charge: the
 * sum equals the single real debit, it does not add to it.
 *
 * Pure + dependency-free → imported from both the TS store (telemetry logging)
 * and the verify script (sum assertion). Single source of truth.
 */

/**
 * Default relative weights per phase. These describe how the cost of a generation
 * run is *attributed* across phases for display — not a real price list. Phases
 * that did not run get 0 weight (excluded). Weights are relative; the absolute
 * deltas are derived by proportioning the real charged total over the active
 * weights, with the remainder pinned to the last active phase so the sum is exact.
 */
export const PHASE_WEIGHTS = {
  designSystem: 1,
  blueprint: 2,
  render: 4,
  images: 2,
  translate: 1,
  publish: 0,
}

/** Stable display order for the timeline. */
export const PHASE_ORDER = ['designSystem', 'blueprint', 'render', 'images', 'translate', 'publish']

/**
 * Proportion a single charged `total` across the phases that ran, weighting each
 * phase by its work amount (pages for render, extra locales for translate, etc.).
 *
 * @param {number} total            the SINGLE real charged credit amount (>= 0)
 * @param {object} ctx
 * @param {number} [ctx.pageCount]      number of pages rendered (>=1), weights `render`
 * @param {number} [ctx.localeCount]    total locales (>=1); extra locales weight `translate`
 * @param {boolean} [ctx.hasImages]     whether image resolution ran (weights `images`)
 * @returns {Array<{ phase: string, creditDelta: number, detail: object }>}
 *   one entry per ACTIVE phase, in PHASE_ORDER. The creditDelta values are
 *   non-negative integers that SUM EXACTLY to `total`.
 */
export function buildPhaseBreakdown(total, ctx = {}) {
  const safeTotal = Math.max(0, Math.round(Number(total) || 0))
  const pageCount = Math.max(1, Math.floor(ctx.pageCount || 1))
  const localeCount = Math.max(1, Math.floor(ctx.localeCount || 1))
  const extraLocales = Math.max(0, localeCount - 1)
  const hasImages = ctx.hasImages !== false // default true (the pipeline resolves images)

  // Per-phase work-scaled weights. designSystem + blueprint always run once.
  const weights = {
    designSystem: PHASE_WEIGHTS.designSystem,
    blueprint: PHASE_WEIGHTS.blueprint,
    render: PHASE_WEIGHTS.render * pageCount,
    images: hasImages ? PHASE_WEIGHTS.images : 0,
    translate: PHASE_WEIGHTS.translate * extraLocales,
    // 'publish' is logged separately (a publish action), never part of a generation
    // breakdown → 0 weight here.
    publish: 0,
  }

  const detailByPhase = {
    designSystem: {},
    blueprint: {},
    render: { pages: pageCount },
    images: {},
    translate: { locales: extraLocales },
    publish: {},
  }

  const active = PHASE_ORDER.filter((p) => weights[p] > 0)
  // Owner / zero-cost generation → every active phase logs creditDelta 0 (the
  // timeline still shows the phases, just at 0 cost). No proportioning needed.
  if (safeTotal === 0 || active.length === 0) {
    return active.map((phase) => ({ phase, creditDelta: 0, detail: detailByPhase[phase] }))
  }

  const weightSum = active.reduce((acc, p) => acc + weights[p], 0)

  // Floor each share, then hand the rounding remainder to the LAST active phase so
  // the deltas sum EXACTLY to safeTotal (no over/under-charge in the display).
  let assigned = 0
  const out = active.map((phase, i) => {
    let delta
    if (i === active.length - 1) {
      delta = safeTotal - assigned // remainder → exact sum
    } else {
      delta = Math.floor((safeTotal * weights[phase]) / weightSum)
      assigned += delta
    }
    return { phase, creditDelta: delta, detail: detailByPhase[phase] }
  })
  return out
}
