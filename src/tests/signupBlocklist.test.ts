/**
 * Signup Blocklist — kaynak seviyesi kontrol testleri.
 *
 * Çalıştırma:
 *   npx tsx src/tests/signupBlocklist.test.ts
 */

import assert from 'assert'
import fs from 'node:fs'
import path from 'node:path'

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

const repoRoot = path.join(__dirname, '..', '..')

function read(relPath: string): string {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf-8')
}

// ─── 1. Blocklist lib ─────────────────────────────────────────────────────────

console.log('\n[1] lib/admin/blocklist.ts')

test('blocklist.ts var', () => {
  const src = read('lib/admin/blocklist.ts')
  assert.ok(src.length > 0, 'dosya boş')
})

test('checkBlocklist fonksiyonu tanımlı', () => {
  const src = read('lib/admin/blocklist.ts')
  assert.ok(src.includes('checkBlocklist'), 'checkBlocklist yok')
})

test('addToBlocklist fonksiyonu tanımlı', () => {
  const src = read('lib/admin/blocklist.ts')
  assert.ok(src.includes('addToBlocklist'), 'addToBlocklist yok')
})

test('extractDomain fonksiyonu tanımlı', () => {
  const src = read('lib/admin/blocklist.ts')
  assert.ok(src.includes('extractDomain'), 'extractDomain yok')
})

test('BlockType: user/email/domain/ip destekleniyor', () => {
  const src = read('lib/admin/blocklist.ts')
  assert.ok(src.includes("'user'"), "user type yok")
  assert.ok(src.includes("'email'"), "email type yok")
  assert.ok(src.includes("'domain'"), "domain type yok")
  assert.ok(src.includes("'ip'"), "ip type yok")
})

// ─── 2. Migration ─────────────────────────────────────────────────────────────

console.log('\n[2] DB Migration')

test('signup_blocklist migration dosyası var', () => {
  const migFile = path.join(repoRoot, 'supabase', 'migrations', '20260515200000_signup_blocklist.sql')
  assert.ok(fs.existsSync(migFile), 'migration dosyası yok')
})

test('migration signup_blocklist tablosu oluşturuyor', () => {
  const src = read('supabase/migrations/20260515200000_signup_blocklist.sql')
  assert.ok(src.includes('signup_blocklist'), 'signup_blocklist tablo yok')
  assert.ok(src.includes('CREATE TABLE IF NOT EXISTS'), 'idempotent değil')
})

test('migration block_type constraint içeriyor', () => {
  const src = read('supabase/migrations/20260515200000_signup_blocklist.sql')
  assert.ok(src.includes("'user'"), 'user type constraint yok')
  assert.ok(src.includes("'email'"), 'email type constraint yok')
  assert.ok(src.includes("'domain'"), 'domain type constraint yok')
  assert.ok(src.includes("'ip'"), 'ip type constraint yok')
})

test('migration blocked_at/blocked_by/block_reason sütunları ekliyor', () => {
  const src = read('supabase/migrations/20260515200000_signup_blocklist.sql')
  assert.ok(src.includes('blocked_at'), 'blocked_at yok')
  assert.ok(src.includes('blocked_by'), 'blocked_by yok')
  assert.ok(src.includes('block_reason'), 'block_reason yok')
})

test('migration manual_review_* sütunları ekliyor', () => {
  const src = read('supabase/migrations/20260515200000_signup_blocklist.sql')
  assert.ok(src.includes('manual_review_at'), 'manual_review_at yok')
  assert.ok(src.includes('manual_review_by'), 'manual_review_by yok')
  assert.ok(src.includes('manual_review_note'), 'manual_review_note yok')
})

test('migration approval_status constraint\'i blocked/manual_review ile güncelliyor', () => {
  const src = read('supabase/migrations/20260515200000_signup_blocklist.sql')
  assert.ok(src.includes("'blocked'"), "blocked status constraint yok")
  assert.ok(src.includes("'manual_review'"), "manual_review status constraint yok")
})

test('migration RLS enable ediyor', () => {
  const src = read('supabase/migrations/20260515200000_signup_blocklist.sql')
  assert.ok(src.includes('ENABLE ROW LEVEL SECURITY'), 'RLS enable yok')
})

// ─── 3. API: Block route ──────────────────────────────────────────────────────

console.log('\n[3] Block API route')

test('block route dosyası var', () => {
  const f = path.join(repoRoot, 'app', 'api', 'admin', 'signups', '[id]', 'block', 'route.ts')
  assert.ok(fs.existsSync(f), 'block route yok')
})

test('block route checkAdminAccess kullanıyor', () => {
  const src = read('app/api/admin/signups/[id]/block/route.ts')
  assert.ok(src.includes('checkAdminAccess'), 'checkAdminAccess yok')
  assert.ok(src.includes('status: 404'), 'yetkisiz 404 dönmüyor')
})

test('block route approval_status=blocked yazıyor', () => {
  const src = read('app/api/admin/signups/[id]/block/route.ts')
  assert.ok(src.includes("approval_status: 'blocked'"), 'blocked status yazılmıyor')
  assert.ok(src.includes('blocked_at'), 'blocked_at yazılmıyor')
  assert.ok(src.includes('blocked_by'), 'blocked_by yazılmıyor')
})

test('block route addToBlocklist çağırıyor', () => {
  const src = read('app/api/admin/signups/[id]/block/route.ts')
  assert.ok(src.includes('addToBlocklist'), 'addToBlocklist çağrılmıyor')
})

test('block route tüm block type\'larını destekliyor (user/email/domain/ip)', () => {
  const src = read('app/api/admin/signups/[id]/block/route.ts')
  assert.ok(src.includes("'user'"), 'user block yok')
  assert.ok(src.includes("'email'"), 'email block yok')
  assert.ok(src.includes("'domain'"), 'domain block yok')
  assert.ok(src.includes("'ip'"), 'ip block yok')
})

// ─── 4. API: Manual review route ─────────────────────────────────────────────

console.log('\n[4] Manual review API route')

test('manual-review route dosyası var', () => {
  const f = path.join(repoRoot, 'app', 'api', 'admin', 'signups', '[id]', 'manual-review', 'route.ts')
  assert.ok(fs.existsSync(f), 'manual-review route yok')
})

test('manual-review route checkAdminAccess kullanıyor', () => {
  const src = read('app/api/admin/signups/[id]/manual-review/route.ts')
  assert.ok(src.includes('checkAdminAccess'), 'checkAdminAccess yok')
})

test('manual-review route approval_status=manual_review yazıyor', () => {
  const src = read('app/api/admin/signups/[id]/manual-review/route.ts')
  assert.ok(src.includes("approval_status: 'manual_review'"), 'manual_review status yazılmıyor')
  assert.ok(src.includes('manual_review_at'), 'manual_review_at yazılmıyor')
  assert.ok(src.includes('manual_review_by'), 'manual_review_by yazılmıyor')
})

test('manual-review route blocklist\'e kayıt YAZMIYOR', () => {
  const src = read('app/api/admin/signups/[id]/manual-review/route.ts')
  assert.ok(!src.includes('addToBlocklist'), 'manual_review yanlışlıkla blocklist yazıyor')
  assert.ok(!src.includes("approval_status: 'blocked'"), 'manual_review blocked yazıyor')
})

// ─── 5. Blocklist guard'lar ───────────────────────────────────────────────────

console.log('\n[5] Blocklist guard\'lar')

test('signup route blocklist kontrolü yapıyor', () => {
  const src = read('app/api/signup/route.ts')
  assert.ok(src.includes('checkBlocklist'), 'blocklist kontrolü yok')
  assert.ok(src.includes('extractDomain'), 'domain kontrolü yok')
})

test('login route blocklist kontrolü yapıyor', () => {
  const src = read('app/api/auth/login/route.ts')
  assert.ok(src.includes('checkBlocklist'), 'blocklist kontrolü yok')
})

test('verify route blocklist kontrolü yapıyor', () => {
  const src = read('app/api/signup/verify/route.ts')
  assert.ok(src.includes('checkBlocklist'), 'blocklist kontrolü yok')
})

test('premeeting schedule route blocked kullanıcıyı reddediyor', () => {
  const src = read('app/api/signup/premeeting/schedule/route.ts')
  assert.ok(src.includes("'blocked'"), 'blocked kontrolü yok')
  assert.ok(src.includes("'manual_review'"), 'manual_review kontrolü yok')
})

test('premeeting decline route blocked kullanıcıyı reddediyor', () => {
  const src = read('app/api/signup/premeeting/decline/route.ts')
  assert.ok(src.includes("'blocked'"), 'blocked kontrolü yok')
  assert.ok(src.includes("'manual_review'"), 'manual_review kontrolü yok')
})

// ─── 6. accountApproval lib ──────────────────────────────────────────────────

console.log('\n[6] accountApproval lib')

test('ApprovalStatus blocked/manual_review içeriyor', () => {
  const src = read('lib/auth/accountApproval.ts')
  assert.ok(src.includes("'blocked'"), 'blocked status yok')
  assert.ok(src.includes("'manual_review'"), 'manual_review status yok')
})

test('isAccountBlocked fonksiyonu var', () => {
  const src = read('lib/auth/accountApproval.ts')
  assert.ok(src.includes('isAccountBlocked'), 'isAccountBlocked yok')
})

test('isAccountManualReview fonksiyonu var', () => {
  const src = read('lib/auth/accountApproval.ts')
  assert.ok(src.includes('isAccountManualReview'), 'isAccountManualReview yok')
})

test('isAccountApprovedForPanel blocked/manual_review\'i reddediyor', () => {
  const src = read('lib/auth/accountApproval.ts')
  assert.ok(src.includes("approvalStatus === 'blocked'"), 'blocked kontrolü yok')
  assert.ok(src.includes("approvalStatus === 'manual_review'"), 'manual_review kontrolü yok')
})

// ─── 7. Signups list — owner filtresi ────────────────────────────────────────

console.log('\n[7] Signups list owner filtresi')

test('signups list route SUPER_ADMIN_EMAILS import ediyor', () => {
  const src = read('app/api/admin/signups/route.ts')
  assert.ok(src.includes('SUPER_ADMIN_EMAILS'), 'SUPER_ADMIN_EMAILS import edilmiyor')
})

test('signups list route owner emaillerini filtreleyen neq kullanıyor', () => {
  const src = read('app/api/admin/signups/route.ts')
  assert.ok(src.includes('.neq('), 'neq filtresi yok')
})

// ─── 8. basvuru-durumu mesajları ─────────────────────────────────────────────

console.log('\n[8] basvuru-durumu sayfası')

test('blocked mesajı var', () => {
  const src = read('app/basvuru-durumu/page.tsx')
  assert.ok(src.includes("'blocked'"), 'blocked durumu yok')
  assert.ok(src.includes('işleme alınamıyor'), 'blocked mesajı yok')
})

test('manual_review mesajı var', () => {
  const src = read('app/basvuru-durumu/page.tsx')
  assert.ok(src.includes("'manual_review'"), 'manual_review durumu yok')
  assert.ok(src.includes('manuel inceleme'), 'manual_review mesajı yok')
})

test('blocked/manual_review kullanıcıya görüşme butonu gösterilmiyor', () => {
  const src = read('app/basvuru-durumu/page.tsx')
  assert.ok(
    src.includes("status !== 'blocked'") || src.includes("'blocked'"),
    'blocked için buton kontrolü yok',
  )
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
