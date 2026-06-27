/**
 * scripts/verify-sandbox-hmac.mjs
 *
 * Saf HMAC yardımcısı için birim testleri.
 * Transpilasyon gerekmez — node ile doğrudan çalıştırılır.
 *
 * Çalıştır: node scripts/verify-sandbox-hmac.mjs
 */

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hmacPath = path.join(__dirname, '../lib/website/sandboxHmac.mjs')
const { verifySandboxSignature, signSandboxBody, isTimestampFresh } = await import(hmacPath)

const secret = 'test-secret'
const body = JSON.stringify({ jobId: 'j1', stage: 'building_page', progress: 40 })

// H1 — geçerli imza kabul edilmeli
const goodSig = 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')
assert.equal(verifySandboxSignature(body, goodSig, secret), true, 'FAIL H1: geçerli imza reddedildi')

// H2 — bozuk imza reddedilmeli
assert.equal(verifySandboxSignature(body, 'sha256=deadbeef', secret), false, 'FAIL H2: bozuk imza kabul edildi')

// H3 — null header reddedilmeli
assert.equal(verifySandboxSignature(body, null, secret), false, 'FAIL H3: null header kabul edildi')

// H4 — farklı secret ile üretilen imza reddedilmeli
const wrongSig = 'sha256=' + crypto.createHmac('sha256', 'wrong-secret').update(body, 'utf8').digest('hex')
assert.equal(verifySandboxSignature(body, wrongSig, secret), false, 'FAIL H4: yanlış secret ile üretilen imza kabul edildi')

// H5 — empty string header reddedilmeli
assert.equal(verifySandboxSignature(body, '', secret), false, 'FAIL H5: boş header kabul edildi')

// H6 — farklı gövde ile aynı imza reddedilmeli (body tampering)
const tamperedBody = JSON.stringify({ jobId: 'j1', stage: 'building_page', progress: 99 })
assert.equal(verifySandboxSignature(tamperedBody, goodSig, secret), false, 'FAIL H6: değiştirilmiş gövde ile aynı imza kabul edildi')

// H7 — signSandboxBody + verifySandboxSignature round-trip
const signed = signSandboxBody(body, secret)
assert.equal(verifySandboxSignature(body, signed, secret), true, 'FAIL H7: signSandboxBody→verifySandboxSignature round-trip başarısız')
assert.ok(signed.startsWith('sha256='), `FAIL H7: imza formatı yanlış — got: ${signed}`)

console.log('sandboxHmac OK — tüm testler geçti')

// ── isTimestampFresh testleri ──────────────────────────────────────────────
let allPassed = true
const nowMs = Date.now()
const nowSec = Math.floor(nowMs / 1000)

function check(label, result, expected) {
  const status = result === expected ? 'PASS' : 'FAIL'
  if (status === 'FAIL') allPassed = false
  console.log(`${status} ${label}`)
}

// T1 — taze timestamp (şimdi) → geçmeli
check('T1: taze timestamp (nowSec)', isTimestampFresh(nowSec, nowMs), true)

// T2 — eski timestamp (now - 600 sn) → reddedilmeli
check('T2: eski timestamp (now - 600 sn)', isTimestampFresh(nowSec - 600, nowMs), false)

// T3 — gelecek timestamp (now + 600 sn) → reddedilmeli
check('T3: gelecek timestamp (now + 600 sn)', isTimestampFresh(nowSec + 600, nowMs), false)

// T4 — eksik timestamp (undefined) → reddedilmeli
check('T4: eksik timestamp (undefined)', isTimestampFresh(undefined, nowMs), false)

// T5 — NaN timestamp → reddedilmeli
check('T5: NaN timestamp', isTimestampFresh(NaN, nowMs), false)

if (!allPassed) {
  console.error('isTimestampFresh: bazı testler başarısız oldu')
  process.exit(1)
}
console.log('isTimestampFresh OK — tüm timestamp testleri geçti')
