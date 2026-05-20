/**
 * Supabase Env Resolution (A6) Tests
 *
 * Çalıştırma:
 *   npx tsx src/tests/supabaseEnvResolution.test.ts
 *
 * resolveSupabaseUrl/Key server-first sırasını ve warnIfSupabaseSplitBrain
 * split-brain tespitini doğrular. (Tüm modüller artık bu helper'ı kullanır.)
 */

import assert from 'assert'

let passed = 0
let failed = 0

function check(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

function freshEnvModule() {
  // Her test ayrı modül örneği — _warned latch sıfırlansın.
  delete require.cache[require.resolve('../../lib/supabase/env.ts')]
  return require('../../lib/supabase/env.ts')
}

const FBQR = 'https://fbqrhyxbdeejfcwsgixr.supabase.co'
const OMDDQ = 'https://omddqhcvhxvzrizehnzw.supabase.co'

console.log('\nSupabase Env Resolution (A6) testleri:\n')

check('resolveSupabaseUrl server-first (SUPABASE_URL öncelikli)', () => {
  process.env.SUPABASE_URL = OMDDQ
  process.env.NEXT_PUBLIC_SUPABASE_URL = FBQR
  const env = freshEnvModule()
  assert.strictEqual(env.resolveSupabaseUrl(), OMDDQ)
})

check('resolveSupabaseUrl NEXT_PUBLIC fallback (SUPABASE_URL yoksa)', () => {
  delete process.env.SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = OMDDQ
  const env = freshEnvModule()
  assert.strictEqual(env.resolveSupabaseUrl(), OMDDQ)
})

check('resolveSupabaseServiceKey: SERVICE_KEY || SERVICE_ROLE_KEY', () => {
  delete process.env.SUPABASE_SERVICE_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'role-key'
  const env = freshEnvModule()
  assert.strictEqual(env.resolveSupabaseServiceKey(), 'role-key')
  process.env.SUPABASE_SERVICE_KEY = 'svc-key'
  const env2 = freshEnvModule()
  assert.strictEqual(env2.resolveSupabaseServiceKey(), 'svc-key')
})

check('warnIfSupabaseSplitBrain: farklı proje → uyarı', () => {
  process.env.SUPABASE_URL = FBQR
  process.env.NEXT_PUBLIC_SUPABASE_URL = OMDDQ
  const env = freshEnvModule()
  let warned = false
  const orig = console.warn
  console.warn = (msg?: unknown) => { if (String(msg).includes('SPLIT-BRAIN')) warned = true }
  try {
    env.warnIfSupabaseSplitBrain()
  } finally {
    console.warn = orig
  }
  assert.strictEqual(warned, true, 'split-brain uyarısı çıkmalı')
})

check('warnIfSupabaseSplitBrain: aynı proje → uyarı YOK', () => {
  process.env.SUPABASE_URL = OMDDQ
  process.env.NEXT_PUBLIC_SUPABASE_URL = OMDDQ
  const env = freshEnvModule()
  let warned = false
  const orig = console.warn
  console.warn = (msg?: unknown) => { if (String(msg).includes('SPLIT-BRAIN')) warned = true }
  try {
    env.warnIfSupabaseSplitBrain()
  } finally {
    console.warn = orig
  }
  assert.strictEqual(warned, false, 'aynı projede uyarı olmamalı')
})

check('warnIfSupabaseSplitBrain: yalnızca bir kez uyarır (latch)', () => {
  process.env.SUPABASE_URL = FBQR
  process.env.NEXT_PUBLIC_SUPABASE_URL = OMDDQ
  const env = freshEnvModule()
  let count = 0
  const orig = console.warn
  console.warn = (msg?: unknown) => { if (String(msg).includes('SPLIT-BRAIN')) count++ }
  try {
    env.warnIfSupabaseSplitBrain()
    env.warnIfSupabaseSplitBrain()
    env.warnIfSupabaseSplitBrain()
  } finally {
    console.warn = orig
  }
  assert.strictEqual(count, 1, 'sadece bir kez uyarmalı')
})

console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
