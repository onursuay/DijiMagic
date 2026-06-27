/**
 * poc/sandbox/worker.mjs
 *
 * Agentic worker — runs INSIDE the Daytona sandbox.
 * Orchestrated by poc/runPoc.mjs which uploads this file and executes it.
 *
 * Responsibilities:
 *   1. Expose in-process MCP tools: get_brand_context, render_gate
 *   2. Run the Agent SDK query() loop (claude-opus-4-8, effort:high)
 *   3. Wall-clock watchdog: abort after 15 minutes
 *   4. Write result to /tmp/work/{JOB_ID}/result.json on completion
 *
 * Environment variables (set by orchestrator via sandbox envVars):
 *   ANTHROPIC_API_KEY  — required
 *   JOB_ID             — unique job identifier (e.g. feribot-1234)
 *   BRIEF              — JSON string of the site brief
 *   SCOPE              — brand context scope identifier
 *   BRAND_CONTEXT_JSON — optional JSON string of pre-fetched brand context
 *
 * Dependencies (installed by orchestrator before this file runs):
 *   @anthropic-ai/claude-agent-sdk, zod, playwright,
 *   tailwindcss, postcss, autoprefixer, sanitize-html, cheerio
 *
 * File layout expected in /tmp/work/{JOB_ID}/:
 *   compile.mjs         — CSS compile CLI wrapper (uploaded by orchestrator)
 *   shot.mjs            — Playwright screenshot helper (uploaded)
 *   renderGate.mjs      — gate module (uploaded)
 *   sanitizeAllowlist.mjs — gate dependency (uploaded)
 *   tailwindCompile.mjs — Tailwind compile core (uploaded)
 *   site/               — created by agent during build
 *   shots/              — created by agent during screenshots
 */

import { writeFile, readFile, mkdir } from 'fs/promises'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import crypto from 'node:crypto'

// ---------------------------------------------------------------------------
// Inline HMAC helper (prod callback — no sandboxHmac.mjs dependency)
// Only active when WEBSITE_CALLBACK_BASE + WEBSITE_SITE_ID + JOB_ID +
// WEBSITE_SANDBOX_HMAC_SECRET are all set (i.e. prod/staging, NOT POC).
// ---------------------------------------------------------------------------
function _sign(rawBody) {
  return 'sha256=' + crypto
    .createHmac('sha256', process.env.WEBSITE_SANDBOX_HMAC_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')
}

const _callbackReady = Boolean(
  process.env.WEBSITE_CALLBACK_BASE &&
  process.env.WEBSITE_SITE_ID &&
  process.env.JOB_ID &&
  process.env.WEBSITE_SANDBOX_HMAC_SECRET,
)

/**
 * POST a signed JSON payload to a Vercel callback endpoint.
 * Adds `ts` (Unix seconds) to the body before signing — route checks freshness (300s window).
 * No-ops silently if callback env vars are missing (POC mode).
 *
 * @param {string} pathSuffix - e.g. 'complete' or 'progress'
 * @param {object} bodyObj    - payload (ts is injected automatically)
 */
async function postCallback(pathSuffix, bodyObj) {
  if (!_callbackReady) return  // POC mode — skip

  const raw = JSON.stringify({ ...bodyObj, ts: Math.floor(Date.now() / 1000) })
  const url = `${process.env.WEBSITE_CALLBACK_BASE}/api/website/${process.env.WEBSITE_SITE_ID}/jobs/${process.env.JOB_ID}/${pathSuffix}`
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sandbox-signature-256': _sign(raw),
      },
      body: raw,
    })
  } catch (e) {
    console.error('[worker] callback fail', pathSuffix, e?.message)
  }
}

// ---------------------------------------------------------------------------
// Agent SDK imports
// ---------------------------------------------------------------------------
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Gate module (sandbox copy — static import for MODULE_NOT_FOUND safety)
// Resolved relative to this file's location in /tmp/work/{JOB_ID}/
// ---------------------------------------------------------------------------
import { gateSiteHtml } from './renderGate.mjs'

// ---------------------------------------------------------------------------
// Prompt imports (uploaded from poc/prompts/ by orchestrator)
// ---------------------------------------------------------------------------
import { DESIGN_SYSTEM_PROMPT } from './designSystem.mjs'
import { buildDrivePrompt } from './buildPrompt.mjs'

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const JOB_ID = process.env.JOB_ID
const BRIEF = process.env.BRIEF ?? (existsSync('./brief.json') ? readFileSync('./brief.json', 'utf8') : '{}')
const SCOPE = process.env.SCOPE ?? 'default'
const BRAND_CONTEXT_JSON = process.env.BRAND_CONTEXT_JSON ?? null

if (!JOB_ID) {
  console.error('[worker] FATAL: JOB_ID env var not set')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[worker] FATAL: ANTHROPIC_API_KEY env var not set')
  process.exit(1)
}

const WORK_DIR = `/tmp/work/${JOB_ID}`

// ---------------------------------------------------------------------------
// Ensure work directories exist
// ---------------------------------------------------------------------------
await mkdir(`${WORK_DIR}/site`, { recursive: true })
await mkdir(`${WORK_DIR}/shots`, { recursive: true })

// ---------------------------------------------------------------------------
// Brand context loader (scope-isolated — cross-business leak prevention)
// ---------------------------------------------------------------------------

/**
 * Load brand context for the given scope.
 * Only returns data for the exact scope — never falls back to a global profile.
 *
 * In the POC, brand context is provided via BRAND_CONTEXT_JSON env var
 * (pre-fetched by the orchestrator from the main app's brand store).
 * Production would call the brand store API with proper auth.
 *
 * @param {string} scope
 * @returns {object} brand context (colors, logo, fonts) or {}
 */
async function loadScopedBrand(scope) {
  // Scope mismatch guard — critical: never return cross-business data
  if (scope !== SCOPE) {
    console.warn(`[worker] get_brand_context: scope mismatch (requested=${scope}, allowed=${SCOPE}) → returning empty`)
    return {}
  }

  if (!BRAND_CONTEXT_JSON) {
    return {}
  }

  try {
    const parsed = JSON.parse(BRAND_CONTEXT_JSON)
    // Return only safe fields — never pass raw credentials or internal IDs
    return {
      accentColor: parsed.accentColor ?? null,
      surfaceColor: parsed.surfaceColor ?? null,
      inkColor: parsed.inkColor ?? null,
      logoUrl: parsed.logoUrl ?? null,
      headingFont: parsed.headingFont ?? null,
      bodyFont: parsed.bodyFont ?? null,
      brandName: parsed.brandName ?? null,
      industry: parsed.industry ?? null,
    }
  } catch (e) {
    console.warn('[worker] BRAND_CONTEXT_JSON parse error:', e.message)
    return {}
  }
}

// ---------------------------------------------------------------------------
// MCP tools (in-process — run in the worker process, not in the agent sandbox)
// ---------------------------------------------------------------------------

const brandTool = tool(
  'get_brand_context',
  'Returns scoped brand colors, logo URL, and font preferences. NEVER falls back to a global profile. Always call with the scope provided in the brief.',
  { scope: z.string().describe('The scope identifier from the job — must match JOB scope') },
  async ({ scope }) => {
    const ctx = await loadScopedBrand(scope)
    return {
      content: [{ type: 'text', text: JSON.stringify(ctx) }],
    }
  },
  { annotations: { readOnlyHint: true } },
)

const gateTool = tool(
  'render_gate',
  'Validates generated body HTML against the publish gate. Returns "GATE PASS" or an error reason key. Call this BEFORE serving and taking screenshots.',
  { html: z.string().describe('The raw body HTML content to validate') },
  async ({ html }) => {
    const result = gateSiteHtml(html)
    if (result.ok) {
      return { content: [{ type: 'text', text: 'GATE PASS' }] }
    }
    // Return as tool error — agent sees the reason and fixes, loop does NOT die
    return {
      content: [{ type: 'text', text: `GATE FAIL: ${result.reason}` }],
      isError: true,
    }
  },
)

const harness = createSdkMcpServer({
  name: 'harness',
  version: '1.0.0',
  tools: [brandTool, gateTool],
})

// ---------------------------------------------------------------------------
// Wall-clock watchdog (15 minutes)
// Worker must finish before the Inngest waitForEvent timeout (17m).
// 15m < 17m ensures worker aborts cleanly (triggering /failed callback +
// sandbox cleanup) before the orchestrator times out and double-cleans.
// ---------------------------------------------------------------------------
const ac = new AbortController()
const watchdogMs = 15 * 60 * 1_000
const killer = setTimeout(() => {
  console.warn('[worker] WATCHDOG: 15 minute wall-clock limit reached — aborting')
  ac.abort()
}, watchdogMs)

// ---------------------------------------------------------------------------
// Build the drive prompt
// ---------------------------------------------------------------------------
const drivePrompt = buildDrivePrompt(BRIEF, SCOPE)

// ---------------------------------------------------------------------------
// Agent SDK query loop
// ---------------------------------------------------------------------------
let finalHtml = ''
let usageLog = null
let agentError = null

console.log(`[worker] Starting agent query (JOB_ID=${JOB_ID}, SCOPE=${SCOPE})`)
const startMs = Date.now()

// Progress stage tracking — used for deduplicating postCallback calls
const _sentStages = new Set()
async function _progress(stage, progress, stepMsg) {
  if (_sentStages.has(stage)) return
  _sentStages.add(stage)
  await postCallback('progress', { stage, progress, stepMsg })
  console.log(`[worker] progress: stage=${stage} progress=${progress} msg=${stepMsg}`)
}

// Emit start progress (design system / prompt-build phase)
await _progress('starting', 5, 'Tasarım sistemi hazırlanıyor')

try {
  for await (const m of query({
    prompt: drivePrompt,
    options: {
      model: 'claude-opus-4-8',
      effort: 'high',           // high quality — POC sweep: high vs xhigh in A5
      systemPrompt: DESIGN_SYSTEM_PROMPT,
      mcpServers: { harness },
      allowedTools: [
        'Read',
        'Write',
        'Edit',
        'Bash',
        'mcp__harness__get_brand_context',
        'mcp__harness__render_gate',
      ],
      disallowedTools: [
        'WebSearch',
        'WebFetch',
        'Bash(curl *)',
        'Bash(wget *)',
        'Bash(fetch *)',
      ],
      permissionMode: 'bypassPermissions',
      settingSources: [],         // CLAUDE.md / global .claude NOT loaded
      cwd: WORK_DIR,
      maxTurns: 40,
      maxBudgetUsd: 6,            // USD hard-cap (client-side estimate)
      abortController: ac,
      env: {
        ...process.env,
        JOB_ID,
        BRIEF,
        SCOPE,
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
        CLAUDE_CONFIG_DIR: `/tmp/cfg-${JOB_ID}`,
        // Note: ENABLE_PROMPT_CACHING_1H removed (D6) — caching is automatic in SDK
      },
      includePartialMessages: true,
    },
  })) {
    if (m.type === 'result') {
      if (m.subtype === 'success') {
        finalHtml = typeof m.result === 'string' ? m.result : ''
      } else {
        agentError = m.subtype
        console.warn(`[worker] Agent result: subtype=${m.subtype}`)
      }

      usageLog = {
        cost_estimate_usd: m.total_cost_usd ?? null,    // estimate only — do not use for billing
        cache_read_tokens: m.usage?.cache_read_input_tokens ?? 0,
        cache_write_tokens: m.usage?.cache_creation_input_tokens ?? 0,
        input_tokens: m.usage?.input_tokens ?? 0,
        output_tokens: m.usage?.output_tokens ?? 0,
        num_turns: m.num_turns ?? 0,
        duration_ms: m.duration_ms ?? (Date.now() - startMs),
        model_usage: m.modelUsage ?? null,
        // Cache health check: cache_read_tokens > 0 means caching is working (D6)
        cache_active: (m.usage?.cache_read_input_tokens ?? 0) > 0,
      }

      console.log('[worker] Agent completed:',
        `turns=${usageLog.num_turns}`,
        `cost_est=$${usageLog.cost_estimate_usd?.toFixed(4) ?? '?'}`,
        `cache_read=${usageLog.cache_read_tokens}`,
        `cache_active=${usageLog.cache_active}`,
      )
    } else if (m.type === 'assistant' && m.message?.content) {
      // Log partial assistant messages for debugging (truncated)
      const textBlocks = m.message.content.filter(b => b.type === 'text')
      if (textBlocks.length > 0) {
        const preview = textBlocks[0].text.slice(0, 100).replace(/\n/g, ' ')
        process.stdout.write(`[worker] agent: ${preview}...\n`)
        // Heuristic stage detection from partial assistant output
        const combined = textBlocks.map(b => b.text).join(' ').toLowerCase()
        if (!_sentStages.has('design_system') && (combined.includes('tasarım sistemi') || combined.includes('design system') || combined.includes('renk paleti') || combined.includes('color palette'))) {
          await _progress('design_system', 20, 'Tasarım sistemi oluşturuluyor')
        } else if (!_sentStages.has('building_page') && (combined.includes('sayfa') || combined.includes('html') || combined.includes('section') || combined.includes('hero'))) {
          await _progress('building_page', 40, 'Sayfa inşa ediliyor')
        } else if (!_sentStages.has('screenshot') && (combined.includes('screenshot') || combined.includes('ekran görüntüsü') || combined.includes('playwright') || combined.includes('shot'))) {
          await _progress('screenshot', 65, 'Ekran görüntüsü alınıyor')
        } else if (!_sentStages.has('critique') && (combined.includes('eleştiri') || combined.includes('critique') || combined.includes('değerlendir') || combined.includes('review') || combined.includes('iyileştir'))) {
          await _progress('critique', 80, 'Tasarım değerlendiriliyor')
        } else if (!_sentStages.has('final_touch') && (combined.includes('son rötuş') || combined.includes('final') || combined.includes('tamamlandı') || combined.includes('gate pass'))) {
          await _progress('final_touch', 92, 'Son rötuşlar uygulanıyor')
        }
      }
    }
  }
} catch (err) {
  if (err.name === 'AbortError') {
    agentError = 'watchdog_abort'
    console.error('[worker] Aborted by watchdog')
  } else {
    agentError = err.message
    console.error('[worker] Query error:', err)
  }
} finally {
  clearTimeout(killer)
}

// ---------------------------------------------------------------------------
// Read result.json written by agent (preferred path)
// Fall back to finalHtml from m.result if agent didn't write the file
// ---------------------------------------------------------------------------
const resultPath = resolve(`${WORK_DIR}/result.json`)
let resultJson = null

try {
  const raw = await readFile(resultPath, 'utf8')
  resultJson = JSON.parse(raw)
  console.log('[worker] result.json read from disk (agent-written)')
} catch {
  // Agent did not write result.json — construct from what we have
  console.warn('[worker] result.json not found — constructing from agent output')
  resultJson = {
    html: finalHtml,
    designVars: {},
    chosenDirection: null,
    rounds: null,
    finalScores: null,
    _fallback: true,
  }
}

// Always merge usage log into result
resultJson.usage = usageLog ?? {}
resultJson.error = agentError ?? null

// Write final result.json (always overwrite to ensure usage is included)
await writeFile(resultPath, JSON.stringify(resultJson, null, 2), 'utf8')
console.log(`[worker] Final result.json written → ${resultPath}`)
console.log(`[worker] Wall time: ${((Date.now() - startMs) / 1000).toFixed(1)}s`)

// ---------------------------------------------------------------------------
// PROD Callback — POST result to Vercel via HMAC-signed HTTP
// Only active when callback env vars are present (see postCallback / _callbackReady).
// POC mode (runPoc): env vars missing → callbacks skipped, result.json read directly.
// ERROR path: do NOT call /complete (route has no error field — breaking contract).
//   Instead: log + exit 1 → orchestrator waitForEvent 12min timeout → markJobFailed + iade.
// ---------------------------------------------------------------------------
if (!agentError) {
  const html = resultJson.html ?? ''
  const designVars = resultJson.designVars ?? {}
  await postCallback('complete', { html, designVars })
  console.log('[worker] /complete callback posted')
} else {
  // Graceful fail — do NOT post /complete (no error field in route contract)
  // Orchestrator's waitForEvent will timeout (12 min) → markJobFailed + credit iade
  console.warn(`[worker] agentError="${agentError}" — skipping /complete callback (watchdog path)`)
}

process.exit(agentError && agentError !== 'watchdog_abort' ? 1 : 0)
