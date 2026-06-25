#!/usr/bin/env node
/**
 * DijiMagic — Email Marketing email_contacts.submitted_at + page_id migration uygulayıcı.
 * Additive + idempotent. CANONICAL (omddq) projeye uygulanır.
 * Gerekli env (.env.local): DATABASE_URL (Transaction mode, port 6543).
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
} catch {}

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!DATABASE_URL) {
  console.error('\n❌  DATABASE_URL bulunamadı (.env.local). omddq Transaction mode (6543) bağlantısı gerekli.')
  console.error('   Alternatif: SQL\'i Supabase Dashboard > SQL Editor (omddq) içine yapıştır.\n')
  process.exit(1)
}
const FILE = 'supabase/migrations/20260610000000_email_contacts_submitted_at_page.sql'
async function main() {
  console.log('\n🚀  Email Marketing email_contacts submitted_at + page_id migration\n')
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const sql = readFileSync(resolve(ROOT, FILE), 'utf8')
    console.log(`▶  ${FILE}`)
    await client.query(sql)
    // Doğrulama — kolonların varlığını kontrol et.
    const { rows } = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='email_contacts' AND column_name IN ('submitted_at','page_id') ORDER BY column_name",
    )
    console.log('   ✓  Eklenen/var olan kolonlar:', rows.map((r) => r.column_name).join(', ') || '(yok!)')
    console.log('   ✓  Başarılı\n')
  } finally {
    await client.end()
  }
}
main().catch((err) => { console.error('\n❌  Migration başarısız:', err.message); process.exit(1) })
