/**
 * scripts/verify-website-codegen.mjs
 *
 * Verify the sanitizeHtml codegen module behaviour.
 *
 * TS-loading approach: instead of transpiling sanitizeHtml.ts, this script
 * imports `sanitize-html` directly and the SAME allowlist from the shared
 * `lib/website/codegen/sanitizeAllowlist.mjs` (single source of truth).
 * This avoids any TS build step and guarantees no allowlist duplication.
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

// Load shared allowlist (ESM .mjs — single source of truth)
const allowlistPath = path.join(__dirname, '../lib/website/codegen/sanitizeAllowlist.mjs')
const {
  SAFE_TAGS,
  SAFE_ATTRS,
  DANGEROUS_STYLE_PATTERNS,
  SAFE_HREF_SCHEMES,
  SAFE_IMG_SRC_RE,
} = await import(allowlistPath)

// ---------------------------------------------------------------------------
// Build the same options object as sanitizeHtml.ts (kept in sync via shared constants)
// ---------------------------------------------------------------------------

const sanitizeOptions = {
  allowedTags: SAFE_TAGS,
  allowedAttributes: SAFE_ATTRS,
  allowedSchemes: SAFE_HREF_SCHEMES,
  allowedSchemesByTag: {
    img: ['https', 'data'],
    source: ['https', 'data'],
  },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'action', 'cite'],
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],

  transformTags: {
    a(tagName, attribs) {
      const href = attribs['href'] ?? ''
      const isRelative = href.startsWith('#') || href.startsWith('/')
      const hasSafeScheme = SAFE_HREF_SCHEMES.some(
        (s) => href.toLowerCase().startsWith(s + ':'),
      )
      if (!isRelative && !hasSafeScheme && href !== '') {
        const { href: _removed, ...rest } = attribs
        return { tagName, attribs: rest }
      }
      const finalAttribs = { ...attribs }
      if (href.startsWith('http') && !finalAttribs['target']) {
        finalAttribs['target'] = '_blank'
        finalAttribs['rel'] = 'noopener noreferrer'
      }
      return { tagName, attribs: finalAttribs }
    },
    img(tagName, attribs) {
      const src = attribs['src'] ?? ''
      if (src && !SAFE_IMG_SRC_RE.test(src)) {
        const { src: _removed, ...rest } = attribs
        return { tagName, attribs: rest }
      }
      return { tagName, attribs }
    },
    '*'(tagName, attribs) {
      if (attribs['style']) {
        const styleVal = attribs['style']
        const isDangerous = DANGEROUS_STYLE_PATTERNS.some((re) => re.test(styleVal))
        if (isDangerous) {
          const { style: _removed, ...rest } = attribs
          return { tagName, attribs: rest }
        }
      }
      return { tagName, attribs }
    },
  },

  exclusiveFilter(frame) {
    return Object.keys(frame.attribs).some((attr) =>
      attr.toLowerCase().startsWith('on'),
    )
  },
}

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

console.log('sanitize OK')
