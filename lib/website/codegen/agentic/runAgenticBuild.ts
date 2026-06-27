/**
 * lib/website/codegen/agentic/runAgenticBuild.ts
 *
 * Production orchestrator for the Faz 2 agentic website builder.
 *
 * Responsibilities:
 *  1. Spawn an ephemeral Daytona sandbox (Node 25, autoStopInterval:0)
 *  2. Install npm deps inside the sandbox
 *  3. Install Playwright Chromium
 *  4. Create work directories
 *  5. Upload worker + helpers + prompts (flat) into /tmp/work/<jobId>/
 *  6. Start worker.mjs DETACHED via createSession + executeSessionCommand(runAsync:true)
 *  7. Return { sandboxId, sessionId, cmdId } immediately — does NOT await worker
 *
 * Security note (T5): ANTHROPIC_API_KEY is passed via `secrets` (not envVars) so it
 * does not appear in Daytona's API response bodies. Egress proxy / allowlist enforcement
 * is handled at T5 — domainAllowList restricts outbound requests to Anthropic + callback host.
 *
 * Vercel file-tracing NOTE (T6/deploy):
 *   This module reads the .mjs worker/helper files from the repo at runtime via fs.readFile.
 *   Vercel's output file tracing does NOT automatically bundle .mjs files referenced only
 *   via runtime `fs.readFile` (not static `import`). These files will be missing in the
 *   Vercel lambda bundle and cause MODULE_NOT_FOUND / ENOENT errors at runtime.
 *   Fix at T6: add `outputFileTracingIncludes` to next.config.ts:
 *     outputFileTracingIncludes: {
 *       '/api/website/**': [
 *         'lib/website/codegen/agentic/sandbox/*.mjs',
 *         'lib/website/codegen/agentic/prompts/*.mjs',
 *         'lib/website/codegen/renderGate.mjs',
 *         'lib/website/codegen/sanitizeAllowlist.mjs',
 *         'lib/website/codegen/tailwindCompile.mjs',
 *         'lib/website/sandboxHmac.mjs',
 *       ],
 *     }
 *   Without this, T2 works locally/in Inngest but will silently fail on Vercel.
 */

import { Daytona } from '@daytona/sdk'
import type { Sandbox } from '@daytona/sdk'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { RunAgenticBuildInput, RunAgenticBuildResult } from './types'

// ---------------------------------------------------------------------------
// Path helpers — works in both CJS (via __dirname) and ESM/bundler contexts
// ---------------------------------------------------------------------------
const MODULE_DIR = (() => {
  try {
    // ESM
    return dirname(fileURLToPath(import.meta.url))
  } catch {
    // CJS / bundler
    return __dirname
  }
})()

// Repo root = MODULE_DIR + ../../../../..
const REPO_ROOT = resolve(MODULE_DIR, '..', '..', '..', '..', '..')

// ---------------------------------------------------------------------------
// File upload map — source paths (repo-relative) + remote flat names
// ---------------------------------------------------------------------------
function buildUploadMap(jobId: string): Array<{ localPath: string; remotePath: string }> {
  const agenticDir = resolve(MODULE_DIR)            // lib/website/codegen/agentic/
  const codegenDir = resolve(MODULE_DIR, '..')      // lib/website/codegen/
  const websiteDir = resolve(MODULE_DIR, '..', '..') // lib/website/

  return [
    // Sandbox worker + helpers
    {
      localPath: resolve(agenticDir, 'sandbox', 'worker.mjs'),
      remotePath: `/tmp/work/${jobId}/worker.mjs`,
    },
    {
      localPath: resolve(agenticDir, 'sandbox', 'compile.mjs'),
      remotePath: `/tmp/work/${jobId}/compile.mjs`,
    },
    {
      localPath: resolve(agenticDir, 'sandbox', 'shot.mjs'),
      remotePath: `/tmp/work/${jobId}/shot.mjs`,
    },
    // Prompts (flattened — worker imports as ./buildPrompt.mjs etc.)
    {
      localPath: resolve(agenticDir, 'prompts', 'buildPrompt.mjs'),
      remotePath: `/tmp/work/${jobId}/buildPrompt.mjs`,
    },
    {
      localPath: resolve(agenticDir, 'prompts', 'designSystem.mjs'),
      remotePath: `/tmp/work/${jobId}/designSystem.mjs`,
    },
    // Canonical shared helpers from lib/website/codegen/ (DRY — worker imports ./renderGate.mjs)
    {
      localPath: resolve(codegenDir, 'tailwindCompile.mjs'),
      remotePath: `/tmp/work/${jobId}/tailwindCompile.mjs`,
    },
    {
      localPath: resolve(codegenDir, 'renderGate.mjs'),
      remotePath: `/tmp/work/${jobId}/renderGate.mjs`,
    },
    {
      localPath: resolve(codegenDir, 'sanitizeAllowlist.mjs'),
      remotePath: `/tmp/work/${jobId}/sanitizeAllowlist.mjs`,
    },
    // HMAC helper (sandbox → Vercel callback signing)
    {
      localPath: resolve(websiteDir, 'sandboxHmac.mjs'),
      remotePath: `/tmp/work/${jobId}/sandboxHmac.mjs`,
    },
  ]
}

// ---------------------------------------------------------------------------
// Internal: install deps + playwright + mkdir + upload
// ---------------------------------------------------------------------------
async function installDepsAndUpload(
  sandbox: Sandbox,
  jobId: string,
  brief: object,
): Promise<void> {
  // 1. npm install
  const installCmd = [
    'npm install --prefix /tmp/work',
    '@anthropic-ai/claude-agent-sdk',
    'playwright',
    'zod',
    'tailwindcss@3',
    'postcss',
    'autoprefixer',
    'sanitize-html',
    'cheerio',
  ].join(' ')

  const installResult = await sandbox.process.executeCommand(
    installCmd,
    '/',
    undefined, // env=undefined: do NOT pass env object — it resets the shell
    300,       // 5 minute timeout
  )
  if (installResult.exitCode !== 0) {
    throw new Error(
      `[runAgenticBuild] npm install failed (exit ${installResult.exitCode}):\n${installResult.result}`,
    )
  }

  // 2. Playwright Chromium (libnss3/gbm already present in default sandbox image)
  const pwResult = await sandbox.process.executeCommand(
    'cd /tmp/work && ./node_modules/.bin/playwright install chromium',
    '/',
    undefined,
    300,
  )
  if (pwResult.exitCode !== 0) {
    throw new Error(
      `[runAgenticBuild] playwright install failed (exit ${pwResult.exitCode}):\n${pwResult.result}`,
    )
  }

  // 3. Create work directories
  await sandbox.process.executeCommand(
    `mkdir -p /tmp/work/${jobId}/site /tmp/work/${jobId}/shots`,
    '/',
    undefined,
    30,
  )

  // 4. Upload worker + helpers
  const uploadMap = buildUploadMap(jobId)
  for (const { localPath, remotePath } of uploadMap) {
    const buf = await readFile(localPath)
    await sandbox.fs.uploadFile(buf, remotePath)
  }

  // 5. Upload brief as JSON file (avoids large env var)
  await sandbox.fs.uploadFile(
    Buffer.from(JSON.stringify(brief)),
    `/tmp/work/${jobId}/brief.json`,
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Spawn a Daytona sandbox, install deps, upload worker files, and start the
 * worker DETACHED. Returns immediately with IDs needed to track the job.
 *
 * The caller (dispatch-sandbox Inngest function) is responsible for:
 *  - Persisting { sandboxId, sessionId, cmdId } to the job store
 *  - Deleting the sandbox when the worker signals completion via callback
 *    (or via deleteSandbox() in a timeout/error handler — see T4)
 */
export async function runAgenticBuild(
  i: RunAgenticBuildInput,
): Promise<RunAgenticBuildResult> {
  const daytona = new Daytona()

  // Extract callback host for egress allowlist
  const callbackHost = new URL(i.callbackBase).host

  // Spawn sandbox
  const sandbox = await daytona.create(
    {
      autoStopInterval: 0,   // never auto-stop — worker may run 5-15 min
      ephemeral: true,       // auto-cleanup after sandbox.delete()
      // ANTHROPIC_API_KEY goes into `secrets` — not exposed in API responses.
      // Daytona substitutes named secrets inside the sandbox process at launch.
      // NOTE (T5): secret substitution via Agent SDK x-api-key TLS header is
      // unverified until first smoke test. envVars fallback is kept intentionally
      // so the worker functions even if secret substitution does not propagate.
      // After smoke confirms substitution works, owner can remove the envVars copy.
      secrets: { ANTHROPIC_API_KEY: 'anthropic-prod' },
      // domainAllowList MUST be a comma-separated STRING, not an array.
      // Restricts outbound egress to Anthropic API + callback host only.
      domainAllowList: `api.anthropic.com,${callbackHost}`,
      envVars: {
        // ANTHROPIC_API_KEY kept here as fallback until smoke confirms secret substitution.
        // Remove after first successful prod smoke test confirms the `secrets` path works.
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
        JOB_ID: i.jobId,
        SCOPE: i.scope,
        BRIEF: JSON.stringify(i.brief),
        BRAND_CONTEXT_JSON: i.brandContextJson,
        WEBSITE_CALLBACK_BASE: i.callbackBase,
        WEBSITE_SITE_ID: i.websiteId,
        WEBSITE_SANDBOX_HMAC_SECRET: i.hmacSecret,
      },
    },
    { timeout: 0 }, // no SDK-level timeout — sandbox has its own watchdog
  )

  // Install deps + upload files (synchronous steps — must finish before detaching)
  await installDepsAndUpload(sandbox, i.jobId, i.brief)

  // Start worker DETACHED via a persistent session
  const sessionId = `gen-${i.jobId}`
  await sandbox.process.createSession(sessionId)

  const workerCommand =
    // NODE_PATH inlined so shell env is not reset by passing an env object
    `NODE_PATH=/tmp/work/node_modules node /tmp/work/${i.jobId}/worker.mjs` +
    ` > /tmp/work/${i.jobId}/worker.log 2>&1`

  const cmdResult = await sandbox.process.executeSessionCommand(
    sessionId,
    { command: workerCommand, runAsync: true },
    // no timeout arg — runAsync returns immediately
  )

  // Return IDs — caller persists these and waits for the callback
  return {
    sandboxId: sandbox.id,
    sessionId,
    cmdId: cmdResult.cmdId,
  }
}

// ---------------------------------------------------------------------------
// Cleanup helper (called by T4 error/timeout handler)
// ---------------------------------------------------------------------------

/**
 * Delete a sandbox by ID. Safe to call after worker completion or on timeout.
 */
export async function deleteSandbox(sandboxId: string): Promise<void> {
  const daytona = new Daytona()
  const sandbox = await daytona.get(sandboxId)
  await sandbox.delete(60)
}
