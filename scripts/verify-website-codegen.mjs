/**
 * scripts/verify-website-codegen.mjs
 *
 * Verify the sanitizeHtml codegen module behaviour.
 *
 * TS-loading approach: instead of transpiling sanitizeHtml.ts, this script
 * imports `sanitize-html` directly and the SAME options factory from the shared
 * `lib/website/codegen/sanitizeAllowlist.mjs` (single source of truth).
 * This avoids any TS build step and guarantees no allowlist duplication —
 * the security fixes exercised here are EXACTLY the same ones used at runtime.
 *
 * Run: node scripts/verify-website-codegen.mjs
 */

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Load sanitize-html (CommonJS package)
const sanitizeHtml = require('sanitize-html')

// Load shared allowlist factory (ESM .mjs — single source of truth)
const allowlistPath = path.join(__dirname, '../lib/website/codegen/sanitizeAllowlist.mjs')
const { buildSanitizeOptions } = await import(allowlistPath)

// ---------------------------------------------------------------------------
// Build options via the shared factory — no logic duplication
// ---------------------------------------------------------------------------

const sanitizeOptions = buildSanitizeOptions()

function sanitizeSiteHtml(bodyHtml) {
  if (!bodyHtml || typeof bodyHtml !== 'string') return ''
  return sanitizeHtml(bodyHtml, sanitizeOptions)
}

// ---------------------------------------------------------------------------
// Assertions — SANITIZE section
// ---------------------------------------------------------------------------

// 1. <script> is stripped
const r1 = sanitizeSiteHtml('<script>alert(1)</script><h1>ok</h1>')
assert.ok(!r1.includes('<script'), `FAIL: <script> not stripped — got: ${r1}`)
assert.ok(!r1.includes('alert(1)'), `FAIL: script content leaked — got: ${r1}`)
assert.ok(r1.includes('<h1>ok</h1>'), `FAIL: <h1> should survive — got: ${r1}`)

// 2. javascript: href is stripped
const r2 = sanitizeSiteHtml('<a href="javascript:x">y</a>')
assert.ok(!r2.includes('javascript:'), `FAIL: javascript: not stripped — got: ${r2}`)

// 3. on* event handlers are stripped
const r3 = sanitizeSiteHtml('<div onclick="alert(1)" class="foo">bar</div>')
assert.ok(!r3.includes('onclick'), `FAIL: onclick not stripped — got: ${r3}`)
assert.ok(r3.includes('class="foo"'), `FAIL: class should survive — got: ${r3}`)

// 4. data-yoai-* attributes are preserved
const r4 = sanitizeSiteHtml('<section data-yoai-reveal class="grid"><h1>x</h1></section>')
assert.ok(r4.includes('data-yoai-reveal'), `FAIL: data-yoai-reveal stripped — got: ${r4}`)
assert.ok(r4.includes('class="grid"'), `FAIL: class="grid" stripped — got: ${r4}`)
assert.ok(r4.includes('<h1>x</h1>'), `FAIL: <h1> stripped — got: ${r4}`)

// 5. Structural tags are preserved
const r5 = sanitizeSiteHtml('<section><div><p>hello</p></div></section>')
assert.ok(r5.includes('<section>'), `FAIL: <section> stripped — got: ${r5}`)
assert.ok(r5.includes('<div>'), `FAIL: <div> stripped — got: ${r5}`)
assert.ok(r5.includes('<p>hello</p>'), `FAIL: <p> stripped — got: ${r5}`)

// 6. <iframe> is stripped (deny-by-default)
const r6 = sanitizeSiteHtml('<iframe src="https://evil.com"></iframe><p>safe</p>')
assert.ok(!r6.includes('<iframe'), `FAIL: <iframe> not stripped — got: ${r6}`)
assert.ok(r6.includes('<p>safe</p>'), `FAIL: <p> stripped — got: ${r6}`)

// 7. style attr with expression() is stripped
const r7 = sanitizeSiteHtml('<div style="width:expression(alert(1))">x</div>')
assert.ok(!r7.includes('expression('), `FAIL: style with expression() not stripped — got: ${r7}`)

// 8. onerror on img is stripped
const r8 = sanitizeSiteHtml('<img src="https://example.com/img.jpg" onerror="alert(1)">')
assert.ok(!r8.includes('onerror'), `FAIL: onerror not stripped — got: ${r8}`)
assert.ok(r8.includes('src='), `FAIL: safe src stripped — got: ${r8}`)

// 9. data:text (non-image) src on img is stripped
const r9 = sanitizeSiteHtml('<img src="data:text/html,<script>alert(1)</script>">')
assert.ok(!r9.includes('data:text/html'), `FAIL: non-image data: URI not stripped — got: ${r9}`)

// 10. Safe data:image/ src on img is preserved
const r10 = sanitizeSiteHtml('<img src="data:image/png;base64,abc123" alt="test">')
assert.ok(r10.includes('data:image/png;base64,abc123'), `FAIL: data:image/ stripped — got: ${r10}`)

// ---------------------------------------------------------------------------
// NEW SECURITY REGRESSION TESTS
// ---------------------------------------------------------------------------

// C1 — <svg><use> with external href is stripped (sprite-injection XSS)
const rC1 = sanitizeSiteHtml('<svg><use href="https://evil.com/x.svg#a"/></svg>')
assert.ok(!rC1.includes('<use'), `FAIL C1: <use> tag not stripped — got: ${rC1}`)
assert.ok(!rC1.includes('evil.com'), `FAIL C1: external href not stripped — got: ${rC1}`)

// I1 — <meta http-equiv=refresh> is stripped (open redirect / exec vector)
const rI1 = sanitizeSiteHtml('<meta http-equiv="refresh" content="0;url=javascript:alert(1)">')
assert.ok(!rI1.includes('<meta'), `FAIL I1: <meta> tag not stripped — got: ${rI1}`)
assert.ok(!rI1.includes('javascript:'), `FAIL I1: javascript: leaked via meta — got: ${rI1}`)

// I2 — <link rel="stylesheet"> is stripped (CSS injection / UI-redress)
const rI2 = sanitizeSiteHtml('<link rel="stylesheet" href="https://evil.com/x.css"><p>safe</p>')
assert.ok(!rI2.includes('<link'), `FAIL I2: <link> tag not stripped — got: ${rI2}`)
assert.ok(rI2.includes('<p>safe</p>'), `FAIL I2: <p> stripped alongside <link> — got: ${rI2}`)

// I3 — SVG <image> with external non-image href is stripped (tracking/CSRF)
const rI3a = sanitizeSiteHtml('<svg><image href="https://evil.com/track.gif"/></svg>')
assert.ok(!rI3a.includes('evil.com'), `FAIL I3a: external SVG image href not stripped — got: ${rI3a}`)

// I3 — SVG <image> with data:image/ href is preserved (legitimate inline use)
const rI3b = sanitizeSiteHtml('<svg><image href="data:image/png;base64,abc123" width="10" height="10"/></svg>')
assert.ok(rI3b.includes('data:image/png;base64,abc123'), `FAIL I3b: data:image/ SVG image href stripped — got: ${rI3b}`)

// I3 — SVG <image> with data:text/html is blocked
const rI3c = sanitizeSiteHtml('<svg><image href="data:text/html,<script>bad</script>"/></svg>')
assert.ok(!rI3c.includes('data:text/html'), `FAIL I3c: data:text/html SVG image href not stripped — got: ${rI3c}`)

// m2 — @import in style attr is stripped
const rM2 = sanitizeSiteHtml('<div style="@import url(https://evil.com/x.css)">x</div>')
assert.ok(!rM2.includes('@import'), `FAIL m2: @import in style not stripped — got: ${rM2}`)

console.log('sanitize OK')

// ---------------------------------------------------------------------------
// TAILWIND section — per-site JIT compile
// ---------------------------------------------------------------------------

// Load the core compile module directly (single source of truth)
const tailwindCompilePath = path.join(__dirname, '../lib/website/codegen/tailwindCompile.mjs')
const { compileSiteCss } = await import(tailwindCompilePath)

// T1 — compile produces .flex, .p-4, and :root with custom var
const css = await compileSiteCss('<div class="flex p-4 text-3xl"></div>', { '--x': '1' })

assert.ok(
  typeof css === 'string' && css.length > 0,
  `FAIL T1: compileSiteCss returned empty — got: ${css}`
)
assert.ok(
  css.includes(':root'),
  `FAIL T1: :root block missing in compiled CSS — got first 500: ${css.slice(0, 500)}`
)
assert.ok(
  css.includes('--x: 1'),
  `FAIL T1: designVar --x missing in :root — got first 500: ${css.slice(0, 500)}`
)
assert.ok(
  css.includes('.flex'),
  `FAIL T1: .flex not in compiled CSS — Tailwind JIT may not have picked up the class`
)
assert.ok(
  css.includes('.p-4'),
  `FAIL T1: .p-4 not in compiled CSS — Tailwind JIT may not have picked up the class`
)

// T2 — empty html still returns valid CSS (preflight + :root)
const cssEmpty = await compileSiteCss('', { '--brand': '#059669' })
assert.ok(
  typeof cssEmpty === 'string',
  `FAIL T2: compileSiteCss with empty html threw or returned non-string`
)
assert.ok(
  cssEmpty.includes(':root'),
  `FAIL T2: :root missing when html is empty — got: ${cssEmpty.slice(0, 200)}`
)
assert.ok(
  cssEmpty.includes('--brand: #059669'),
  `FAIL T2: designVar --brand missing when html is empty`
)

// T3 — empty designVars: no :root block prepended (empty object = no :root)
const cssNoVars = await compileSiteCss('<p class="text-sm"></p>', {})
assert.ok(
  typeof cssNoVars === 'string' && cssNoVars.length > 0,
  `FAIL T3: compileSiteCss with empty designVars returned empty`
)
// :root from preflight may or may not appear; our custom :root block should NOT
// (no vars means buildRootBlock returns '' — we don't prepend anything)
// Just assert the utility class is present
assert.ok(
  cssNoVars.includes('.text-sm'),
  `FAIL T3: .text-sm missing in compiled CSS`
)

console.log('tailwind OK')
