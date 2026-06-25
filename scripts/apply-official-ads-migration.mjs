#!/usr/bin/env node
/**
 * DijiAlgoritma — Resmi Reklam Bilgi Tabanı Migration Uygulayıcı (Alt-proje B)
 *
 * Uygular:
 *   1. 20260512000000_create_official_ads_knowledge_base.sql
 *      (official_ads_sources, official_ads_knowledge_items,
 *       official_ads_doc_snapshots, official_ads_refresh_runs
 *       + index + updated_at trigger + Google/Meta kaynak seed'leri
 *       + Meta objective / Google campaign_type knowledge seed'leri)
 *
 * Kullanım:
 *   node scripts/apply-official-ads-migration.mjs
 *   # veya:  npm run db:migrate:official-ads
 *
 * Gerekli env (.env.local):
 *   DATABASE_URL — Supabase Dashboard > Project Settings > Database
 *                  > Connection string (URI) > Transaction mode (port 6543)
 *                  ⚠️ CANONICAL PROJE = omddqhcvhxvzrizehnzw (fbqr ÖLÜ — kullanma).
 *
 * Tümü additive + idempotent (CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING)
 * — tekrar çalıştırmak güvenlidir.
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
    label: '[1/1] official_ads_sources + knowledge_items + doc_snapshots + refresh_runs',
    file:  'supabase/migrations/20260512000000_create_official_ads_knowledge_base.sql',
  },
]

async function main() {
  console.log('\n🚀  Resmi Reklam Bilgi Tabanı Migration Başlıyor...\n')

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

    // Doğrulama: 4 tablo gerçekten oluştu mu?
    const { rows } = await client.query(
      `SELECT
         to_regclass('public.official_ads_sources')         AS official_ads_sources,
         to_regclass('public.official_ads_knowledge_items')  AS official_ads_knowledge_items,
         to_regclass('public.official_ads_doc_snapshots')    AS official_ads_doc_snapshots,
         to_regclass('public.official_ads_refresh_runs')     AS official_ads_refresh_runs`,
    )
    const r = rows[0] || {}
    console.log('   Doğrulama:')
    console.log(`     official_ads_sources         = ${r.official_ads_sources ?? 'YOK'}`)
    console.log(`     official_ads_knowledge_items = ${r.official_ads_knowledge_items ?? 'YOK'}`)
    console.log(`     official_ads_doc_snapshots   = ${r.official_ads_doc_snapshots ?? 'YOK'}`)
    console.log(`     official_ads_refresh_runs    = ${r.official_ads_refresh_runs ?? 'YOK'}\n`)

    const allOk = r.official_ads_sources && r.official_ads_knowledge_items && r.official_ads_doc_snapshots && r.official_ads_refresh_runs
    if (!allOk) {
      console.error('❌  Bazı tablolar oluşmadı — yukarıya bak.\n')
      process.exit(1)
    }

    // Seed sayıları (bilgi amaçlı)
    const { rows: counts } = await client.query(
      `SELECT
         (SELECT count(*) FROM official_ads_sources)         AS sources,
         (SELECT count(*) FROM official_ads_knowledge_items)  AS items`,
    )
    const c = counts[0] || {}
    console.log(`   Seed: ${c.sources ?? 0} kaynak, ${c.items ?? 0} onaylı bilgi öğesi\n`)

    console.log('✅  Migration tamamlandı.\n')
  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('\n❌  Migration başarısız:', err.message)
  process.exit(1)
})
