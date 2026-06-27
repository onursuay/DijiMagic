/**
 * scripts/verify-job-progress.mjs
 *
 * Test that mapJobToStageIndex correctly maps job stage strings to
 * WizardBuildingAnimation stage indices (0, 1, 2).
 *
 * Run: node scripts/verify-job-progress.mjs
 */

import assert from 'node:assert/strict'
import { mapJobToStageIndex } from '../lib/website/jobProgress.mjs'

assert.equal(mapJobToStageIndex('queued'), 0, 'FAIL: queued→0')
assert.equal(mapJobToStageIndex('design_system'), 0, 'FAIL: design_system→0')
assert.equal(mapJobToStageIndex('building_page'), 1, 'FAIL: building_page→1')
assert.equal(mapJobToStageIndex('polishing'), 2, 'FAIL: polishing→2')
assert.equal(mapJobToStageIndex('completed'), 2, 'FAIL: completed→2')
console.log('jobProgress OK')
