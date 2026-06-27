#!/usr/bin/env node
/**
 * scripts/website/setup-daytona-secret.mjs
 *
 * Idempotent one-time setup: registers the Anthropic API key as a Daytona
 * named secret so sandbox workers can use it without the key appearing in
 * Daytona API response bodies (envVars is never exposed; secrets are
 * substituted in-process inside the sandbox).
 *
 * Usage (run once, then hide this file):
 *   ANTHROPIC_API_KEY=sk-ant-... DAYTONA_API_KEY=... node scripts/website/setup-daytona-secret.mjs
 *
 * Idempotency: if a secret named 'anthropic-prod' already exists, the script
 * will attempt to update it (overwrite). If the SDK does not support update,
 * it will log a warning and exit cleanly (non-fatal).
 *
 * DO NOT commit this file with real keys — the script reads from env only.
 */

import { Daytona } from '@daytona/sdk'

const SECRET_NAME = 'anthropic-prod'

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.error('[setup-daytona-secret] ERROR: ANTHROPIC_API_KEY env var is not set.')
  process.exit(1)
}

if (!process.env.DAYTONA_API_KEY) {
  console.error('[setup-daytona-secret] ERROR: DAYTONA_API_KEY env var is not set.')
  process.exit(1)
}

const d = new Daytona()

console.log(`[setup-daytona-secret] Registering secret "${SECRET_NAME}" (hosts: api.anthropic.com)…`)

try {
  // Primary path: create with host-scoped egress
  // hosts:string[] restricts egress substitution to api.anthropic.com only
  await d.secret.create({
    name: SECRET_NAME,
    value: apiKey,
    hosts: ['api.anthropic.com'],
  })
  console.log(`[setup-daytona-secret] ✓ Secret "${SECRET_NAME}" created successfully.`)
} catch (err) {
  const msg = String(err?.message ?? err)

  // If already exists, attempt update/overwrite
  if (msg.includes('already exists') || msg.includes('conflict') || msg.includes('409')) {
    console.warn(`[setup-daytona-secret] Secret "${SECRET_NAME}" already exists — attempting update…`)
    try {
      // Some SDK versions expose d.secret.update(); fall back gracefully if not
      if (typeof d.secret.update === 'function') {
        await d.secret.update({ name: SECRET_NAME, value: apiKey, hosts: ['api.anthropic.com'] })
        console.log(`[setup-daytona-secret] ✓ Secret "${SECRET_NAME}" updated.`)
      } else {
        console.warn(
          `[setup-daytona-secret] SDK has no update() method — secret value unchanged. ` +
          `Delete manually in Daytona dashboard and re-run if you need to rotate.`,
        )
      }
    } catch (updateErr) {
      console.warn(`[setup-daytona-secret] Update attempt failed: ${updateErr?.message ?? updateErr}`)
      console.warn(`[setup-daytona-secret] Existing secret kept — rotation requires manual deletion.`)
    }
  } else {
    // Unexpected error
    console.error(`[setup-daytona-secret] ERROR: ${msg}`)
    process.exit(1)
  }
}

// Verify: list secrets and confirm our name is present (values are never returned)
try {
  const list = await d.secret.list()
  const found = Array.isArray(list) && list.some((s) => s.name === SECRET_NAME)
  if (found) {
    console.log(`[setup-daytona-secret] ✓ Verification passed: "${SECRET_NAME}" is present in secret list.`)
  } else {
    console.warn(
      `[setup-daytona-secret] WARNING: "${SECRET_NAME}" not found in secret list after create. ` +
      `Check Daytona dashboard manually.`,
    )
  }
} catch (listErr) {
  console.warn(`[setup-daytona-secret] Could not verify via secret.list(): ${listErr?.message ?? listErr}`)
}

console.log('[setup-daytona-secret] Done.')
