#!/usr/bin/env node
/**
 * DijiAlgoritma — Per-Ad Improvement Cards Migration Uygulayıcı
 *
 * Uygular:
 *   1. 20260520000000_create_ai_ad_improvements.sql
 *      (ai_ad_improvements tablosu + RLS + touch trigger
 *       + user_business_intelligence Claude sentez kolonları)
 *
 * Kullanım:
 *   node scripts/apply-per-ad-improvements-migration.mjs
 *   # veya:  npm run db:migrate:per-ad
 *
 * Gerekli env (.env.local):
 *   DATABASE_URL — Supabase Dashboard > Project Settings > Database
 *                  > Connection string (URI) > Transaction mode (port 6543)
 *                  ⚠️ CANONICAL PROJE = omddqhcvhxvzrizehnzw (fbqr ÖLÜ — kullanma).
 *
 * Tümü additive + idempotent — tekrar çalıştırmak güvenlidir.
 */

import { readFileSync } from 'fs'
import { resolve }      from 'path'
import pg               from 'pg'

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
  console.error('   .env.local dosyasına CANONICAL (omddq) projenin bağlantı dizisini ekle:')
  console.error('   DATABASE_URL=postgresql://postgres.omddqhcvhxvzrizehnzw:[ŞİFRE]@aws-0-[region].pooler.supabase.com:6543/postgres\n')
  process.exit(1)
}

// Güvenlik kontrolü: ölü fbqr projesine yanlışlıkla uygulama
if (DATABASE_URL.includes('fbqrhyxbdeejfcwsgixr')) {
  console.error('\n❌  DATABASE_URL ÖLÜ fbqr projesine işaret ediyor. omddq kullan.\n')
  process.exit(1)
}

const MIGRATIONS = [
  {
    label: '[1/1] ai_ad_improvements + user_business_intelligence sentez kolonları',
    file:  'supabase/migrations/20260520000000_create_ai_ad_improvements.sql',
  },
]

async function main() {
  console.log('\n🚀  Per-Ad Improvements Migration Başlıyor...\n')

  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  client.on('notice', msg => {
    if (msg.message) console.log(`   ℹ  ${msg.message}`)
  })

  try {
    for (const { label, file } of MIGRATIONS) {
      const path = resolve(ROOT, file)
      const sql  = readFileSync(path, 'utf8')
      console.log(`▶  ${label}`)
      console.log(`   Dosya: ${file}`)
      await client.query(sql)
      console.log(`   ✓  Başarılı\n`)
    }

    // Doğrulama: tablo ve kolonlar gerçekten oluştu mu?
    const { rows: t } = await client.query(
      `SELECT to_regclass('public.ai_ad_improvements') AS tbl`,
    )
    const { rows: c } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'user_business_intelligence'
          AND column_name IN ('ai_synthesis','ai_synthesis_model','ai_synthesis_at')`,
    )
    console.log(`   Doğrulama: ai_ad_improvements = ${t[0]?.tbl ?? 'YOK'}`)
    console.log(`   Doğrulama: sentez kolonları = ${c.map(r => r.column_name).join(', ') || 'YOK'}\n`)

    console.log('✅  Migration tamamlandı.\n')
  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('\n❌  Migration başarısız:', err.message)
  process.exit(1)
})
