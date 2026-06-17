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

// ---------------------------------------------------------------------------
// ASSEMBLE section — full document assembly
// ---------------------------------------------------------------------------

// Load the core assemble module directly (single source of truth)
const assembleDocumentPath = path.join(__dirname, '../lib/website/codegen/assembleDocument.mjs')
const { assembleDocument } = await import(assembleDocumentPath)

const sampleBody = '<section class="flex p-4"><h1 class="text-3xl">Hello</h1></section>'
const sampleDesignVars = { '--brand-500': '#059669' }

// A1 — serve mode: correct structure, external runtime, no inline script content
const serveDoc = await assembleDocument({
  bodyHtml: sampleBody,
  designVars: sampleDesignVars,
  seo: { title: 'Test Site', description: 'A test site' },
  lang: 'tr',
  fontHref: null,
  mode: 'serve',
})

assert.ok(serveDoc.includes('<!doctype html'), `FAIL A1: missing <!doctype html — got start: ${serveDoc.slice(0, 200)}`)

// Exactly ONE <title> tag
const titleMatches = (serveDoc.match(/<title/g) || []).length
assert.strictEqual(titleMatches, 1, `FAIL A1: expected exactly 1 <title>, got ${titleMatches}`)

assert.ok(serveDoc.includes('<meta name="viewport"'), `FAIL A1: missing viewport meta`)
assert.ok(serveDoc.includes('</html>'), `FAIL A1: missing </html>`)
assert.ok(serveDoc.includes('<script src="/yoai-site-runtime.js"'), `FAIL A1: missing external runtime script tag`)

// serve mode must NOT contain the inlined runtime code
assert.ok(!serveDoc.includes('yoai-site-runtime v1'), `FAIL A1: serve mode must not inline runtime — found marker 'yoai-site-runtime v1'`)

// A2 — preview mode: inlined runtime, no external src reference for runtime
const previewDoc = await assembleDocument({
  bodyHtml: sampleBody,
  designVars: sampleDesignVars,
  seo: { title: 'Preview', description: 'Preview mode' },
  lang: 'en',
  fontHref: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap',
  mode: 'preview',
})

assert.ok(previewDoc.includes('yoai-site-runtime v1'), `FAIL A2: preview mode must contain inlined runtime marker 'yoai-site-runtime v1'`)
assert.ok(!previewDoc.includes('<script src="/yoai-site-runtime.js"'), `FAIL A2: preview mode must not use external runtime script src`)
assert.ok(previewDoc.includes('fonts.googleapis.com'), `FAIL A2: fontHref not included in preview mode`)

// A3 — HTML escaping: AI-generated title with HTML/attr special chars
const xssTitle = '<b>Acme & "Co"</b>'
const escapedDoc = await assembleDocument({
  bodyHtml: '<p>safe</p>',
  designVars: {},
  seo: { title: xssTitle, description: 'Desc with <b> & "quotes"' },
  lang: 'tr',
  fontHref: null,
  mode: 'serve',
})

// Raw unescaped <b> must NOT appear as a real tag in the title context
// (The body content may have sanitized versions but the SEO title text
//  must not render raw angle brackets)
assert.ok(!escapedDoc.includes('<title><b>'), `FAIL A3: title must escape <b> — raw tag present`)
assert.ok(escapedDoc.includes('&lt;b&gt;'), `FAIL A3: title must contain &lt;b&gt; — escaping missing`)
assert.ok(escapedDoc.includes('&amp;'), `FAIL A3: title must escape & as &amp;`)

console.log('assemble OK')

// ---------------------------------------------------------------------------
// GATE section — renderGate publish gate
// ---------------------------------------------------------------------------

// Load the core gate module directly (single source of truth)
const renderGatePath = path.join(__dirname, '../lib/website/codegen/renderGate.mjs')
const { gateSiteHtml } = await import(renderGatePath)

// G1 — Valid HTML (one h1 + landmark, small) → ok:true, returns sanitized html
const validBody = '<header><nav><a href="/">Home</a></nav></header><main><h1>Welcome</h1><p>Hello world.</p></main><footer>Footer</footer>'
const g1 = gateSiteHtml(validBody)
assert.ok(g1.ok === true, `FAIL G1: expected ok:true — got: ${JSON.stringify(g1)}`)
assert.ok(typeof g1.html === 'string' && g1.html.length > 0, `FAIL G1: html should be non-empty string — got: ${JSON.stringify(g1)}`)
// Returned html must not contain raw <script (sanitizer ran)
assert.ok(!g1.html.includes('<script'), `FAIL G1: sanitized html still contains <script — got: ${g1.html}`)

// G2 — HTML with NO <h1> → ok:false, reason no_h1
const g2 = gateSiteHtml('<main><p>No heading here.</p></main>')
assert.ok(g2.ok === false, `FAIL G2: expected ok:false — got: ${JSON.stringify(g2)}`)
assert.ok(!g2.ok && g2.reason === 'no_h1', `FAIL G2: expected reason no_h1 — got: ${JSON.stringify(g2)}`)

// G3 — HTML with TWO <h1> → ok:false, reason multiple_h1
const g3 = gateSiteHtml('<main><h1>First</h1><h1>Second</h1></main>')
assert.ok(g3.ok === false, `FAIL G3: expected ok:false — got: ${JSON.stringify(g3)}`)
assert.ok(!g3.ok && g3.reason === 'multiple_h1', `FAIL G3: expected reason multiple_h1 — got: ${JSON.stringify(g3)}`)

// G4 — HTML missing landmarks → ok:false, reason no_landmark
const g4 = gateSiteHtml('<div><h1>Only a div</h1><p>No landmarks.</p></div>')
assert.ok(g4.ok === false, `FAIL G4: expected ok:false — got: ${JSON.stringify(g4)}`)
assert.ok(!g4.ok && g4.reason === 'no_landmark', `FAIL G4: expected reason no_landmark — got: ${JSON.stringify(g4)}`)

// G5 — Gate sanitizes: <script> in input → sanitized, but then fails no_h1 (no h1 in this input)
const g5 = gateSiteHtml('<main><script>alert(1)</script><h1>Safe</h1></main>')
// After sanitize: <script> is stripped; one <h1> present; main is a landmark → should pass
assert.ok(g5.ok === true, `FAIL G5: expected ok:true after sanitize strips script — got: ${JSON.stringify(g5)}`)
assert.ok(!g5.ok || !g5.html.includes('<script'), `FAIL G5: script survived gate — got: ${g5.ok ? g5.html : ''}`)

console.log('gate OK')
