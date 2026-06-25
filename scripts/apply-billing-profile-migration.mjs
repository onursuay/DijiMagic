#!/usr/bin/env node
/**
 * DijiMagic Billing — Kullanıcı Fatura Profili Migration Uygulayıcı (H9)
 *
 * Uygular:
 *   20260620000000_user_billing_profile.sql
 *     - user_billing_profile tablosu (fatura/vergi bilgisi sunucu tarafı)
 *
 * NOT: Bu migration ADDITIVE'tir — kod, tablo olmadan da güvenli çalışır
 * (getBillingProfile null döner → checkout placeholder fallback'e düşer).
 * Yine de gerçek fatura bilgisinin iyzico'ya gitmesi için uygulanmalıdır.
 *
 * Kullanım:
 *   node scripts/apply-billing-profile-migration.mjs
 *
 * Gerekli env (.env.local):
 *   DATABASE_URL — CANONICAL (omddq) Supabase bağlantı stringi (Transaction mode, 6543).
 *
 * Alternatif: SQL'i Supabase Dashboard > SQL Editor (omddq) içine yapıştır
 * (CREATE TABLE IF NOT EXISTS — idempotent, tekrar çalıştırmak güvenli).
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import pg from 'pg'

const { Client } = pg
const ROOT = process.cwd()

try {
  const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch { /* .env.local yoksa geç */ }

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

if (!DATABASE_URL) {
  console.error('\n❌  DATABASE_URL bulunamadı.\n')
  console.error('   .env.local dosyasına CANONICAL (omddq) bağlantı stringini ekle veya')
  console.error('   SQL\'i Supabase Dashboard > SQL Editor (omddq) içine yapıştırıp çalıştır.\n')
  process.exit(1)
}

const FILE = 'supabase/migrations/20260620000000_user_billing_profile.sql'

async function main() {
  console.log('\n🚀  DijiMagic Billing — Kullanıcı Fatura Profili Migration\n')
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const sql = readFileSync(resolve(ROOT, FILE), 'utf8')
    console.log(`▶  ${FILE}`)
    client.on('notice', msg => { if (msg.message) console.log(`   ℹ  ${msg.message}`) })
    await client.query(sql)
    console.log('   ✓  Başarılı\n')
    console.log('✅  Migration uygulandı. Doğrulama (psql/SQL Editor):')
    console.log("     SELECT to_regclass('public.user_billing_profile');\n")
  } catch (err) {
    console.error(`   ✗  Başarısız: ${err.message}\n`)
    throw err
  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('\n❌  Migration başarısız:', err.message)
  process.exit(1)
})
