/**
 * poc/sandbox/compile.mjs
 *
 * CLI wrapper around compileSiteCss() for use inside the sandbox.
 *
 * Usage: node compile.mjs <body.html path> [designVars.json path]
 * Output: compiled CSS printed to stdout
 * Exit code: 0 on success, 1 on error
 *
 * The agent calls this as:
 *   node /work/{JOB_ID}/compile.mjs /work/{JOB_ID}/site/body.html > /work/{JOB_ID}/site/site.css
 *
 * designVars is optional — if provided, the :root{} block is prepended.
 * designVars JSON format: { "--accent": "#e03c31", "--surface": "#faf8f5", ... }
 *
 * Dependencies (must be installed in sandbox):
 *   tailwindcss, postcss, autoprefixer
 */

import { readFile } from 'fs/promises'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Import compileSiteCss from the sandbox copy of tailwindCompile.mjs
// Path is relative to this file — both live in /work/{JOB_ID}/
// ---------------------------------------------------------------------------
// Use import.meta.url-relative resolution so this works regardless of cwd
import { compileSiteCss } from './tailwindCompile.mjs'

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const [, , bodyHtmlPath, designVarsPath] = process.argv

if (!bodyHtmlPath) {
  console.error('Usage: node compile.mjs <body.html path> [designVars.json path]')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
try {
  const absHtmlPath = resolve(bodyHtmlPath)
  const bodyHtml = await readFile(absHtmlPath, 'utf8')

  let designVars = {}
  if (designVarsPath) {
    try {
      const raw = await readFile(resolve(designVarsPath), 'utf8')
      designVars = JSON.parse(raw)
    } catch (e) {
      // designVars file is optional — log warning but continue
      process.stderr.write(`[compile] Warning: could not read designVars: ${e.message}\n`)
    }
  }

  const css = await compileSiteCss(bodyHtml, designVars)
  process.stdout.write(css)
  process.exit(0)
} catch (err) {
  process.stderr.write(`[compile] Error: ${err.message}\n`)
  process.stderr.write(err.stack + '\n')
  process.exit(1)
}
