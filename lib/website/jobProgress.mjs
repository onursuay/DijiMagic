/**
 * lib/website/jobProgress.mjs
 *
 * Pure stage-mapping helpers for the Agentic Website Generator job polling UI.
 * Kept as .mjs so it can be imported in both Node test scripts and Next.js client components.
 *
 * STAGE_KEYS must align with the website.building i18n namespace keys
 * (locales/tr.json + locales/en.json → website.building.stageDesignSystem etc.)
 */

export const STAGE_KEYS = ['stageDesignSystem', 'stageBuildingPage', 'stagePolishing']

/**
 * Map a job `stage` string from GET /api/website/[id]/job into a
 * WizardBuildingAnimation stage index (0 | 1 | 2).
 *
 * @param {string | undefined} stage
 * @returns {0 | 1 | 2}
 */
export function mapJobToStageIndex(stage) {
  if (stage === 'design_system' || stage === 'queued') return 0
  if (stage === 'building_page') return 1
  return 2 // polishing | completed | screenshot | critique | finalizing | other
}
