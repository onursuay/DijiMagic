/**
 * poc/sandbox/shot.mjs
 *
 * Playwright CDP device-emulation screenshot helper.
 * Runs INSIDE the Daytona sandbox (Node 25, Chromium available via playwright).
 *
 * Usage: node shot.mjs <url> <outDir>
 *
 * Produces 4 files in outDir:
 *   pc-fold.png     — Desktop Chrome, above-the-fold (viewport height)
 *   pc-full.png     — Desktop Chrome, full page
 *   mobile-fold.png — Pixel 7 emulation, above-the-fold
 *   mobile-full.png — Pixel 7 emulation, full page
 *
 * IMPORTANT: Uses CDP device descriptors (devices['Desktop Chrome'], devices['Pixel 7']).
 * --window-size flag is BANNED — it bypasses CDP emulation and produces fake cropping.
 * See memory: mobile-qa-cdp-method.
 *
 * Chromium is launched headless (default in playwright). No --window-size arg passed.
 */

import { chromium, devices } from 'playwright'
import { mkdir } from 'fs/promises'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Validate CLI args
// ---------------------------------------------------------------------------
const [, , url, outDir] = process.argv

if (!url || !outDir) {
  console.error('Usage: node shot.mjs <url> <outDir>')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Targets: CDP device descriptors
// --window-size is BANNED — use device descriptors only
// ---------------------------------------------------------------------------
const TARGETS = [
  { name: 'pc',     descriptor: devices['Desktop Chrome'] },
  { name: 'mobile', descriptor: devices['Pixel 7'] },
]

// ---------------------------------------------------------------------------
// Ensure output directory exists
// ---------------------------------------------------------------------------
const absOutDir = resolve(outDir)
await mkdir(absOutDir, { recursive: true })

// ---------------------------------------------------------------------------
// Launch browser (headless default — no explicit headless flag needed)
// ---------------------------------------------------------------------------
const browser = await chromium.launch()

try {
  for (const target of TARGETS) {
    // Create context using CDP device descriptor for authentic emulation
    // This sets viewport, deviceScaleFactor, userAgent, isMobile, hasTouch
    const ctx = await browser.newContext({ ...target.descriptor })
    const page = await ctx.newPage()

    // Navigate and wait for network to settle
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

    // Above-the-fold (viewport screenshot)
    await page.screenshot({
      path: `${absOutDir}/${target.name}-fold.png`,
      // No fullPage — captures only the visible viewport (above-the-fold)
    })

    // Full page screenshot
    await page.screenshot({
      path: `${absOutDir}/${target.name}-full.png`,
      fullPage: true,
    })

    await ctx.close()
    console.log(`[shot] ${target.name}: done → ${absOutDir}/${target.name}-*.png`)
  }
} finally {
  await browser.close()
}

console.log('[shot] all screenshots complete')
