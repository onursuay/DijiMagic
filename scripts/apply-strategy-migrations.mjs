#!/usr/bin/env node
/**
 * YoAi Strateji — Migration Uygulayıcı
 *
 * Sırasıyla uygular:
 *   1. 20260516000000_strategy_user_id_rls.sql
 *      (user_id kolonu, RLS policy'ler, deduct_strategy_credit RPC,
 *       strategy_tasks category fix)
 *   2. 20260516100000_strategy_instances_user_id_backfill.sql
 *      (NULL user_id kayıtlarını meta_connections üzerinden backfill)
 *
 * Kullanım:
 *   node scripts/apply-strategy-migrations.mjs
 *
 * Gerekli env:
 *   DATABASE_URL — Supabase Dashboard > Project Settings > Database
 *                  > Connection string (URI) > Transaction mode (port 6543)
 *
 * .env.local'da yoksa buradan al:
 *   https://supabase.com/dashboard/project/fbqrhyxbdeejfcwsgixr/settings/database
 */

import { readFileSync } from 'fs'
import { resolve }      from 'path'
import pg               from 'pg'

const { Client } = pg
const ROOT = process.cwd()

// .env.local oku
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
  console.error('   .env.local dosyasına şunu ekle:')
  console.error('   DATABASE_URL=postgresql://postgres.[ref]:[ŞİFRE]@aws-0-[region].pooler.supabase.com:6543/postgres\n')
  console.error('   Şuradan kopyala:')
  console.error('   https://supabase.com/dashboard/project/fbqrhyxbdeejfcwsgixr/settings/database')
  console.error('   (Transaction mode bağlantı stringi — port 6543)\n')
  process.exit(1)
}

const MIGRATIONS = [
  {
    label: '[1/2] RLS Politikaları + user_id kolonu + deduct_strategy_credit RPC',
    file:  'supabase/migrations/20260516000000_strategy_user_id_rls.sql',
  },
  {
    label: '[2/2] NULL user_id Backfill (meta_connections üzerinden)',
    file:  'supabase/migrations/20260516100000_strategy_instances_user_id_backfill.sql',
  },
]

async function main() {
  console.log('\n🚀  YoAi Strateji Migration Başlıyor...\n')

  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    for (const { label, file } of MIGRATIONS) {
      const path = resolve(ROOT, file)
      const sql  = readFileSync(path, 'utf8')

      console.log(`▶  ${label}`)
      console.log(`   Dosya: ${file}`)

      try {
        // RAISE NOTICE mesajlarını yakala ve göster
        client.on('notice', msg => {
          if (msg.message) console.log(`   ℹ  ${msg.message}`)
        })

        await client.query(sql)
        console.log(`   ✓  Başarılı\n`)
      } catch (err) {
        console.error(`   ✗  Başarısız: ${err.message}\n`)
        throw err
      }
    }

    console.log('✅  Tüm migration\'lar uygulandı.\n')
    console.log('   Sonraki adım: Vercel üzerinde deployment otomatik çalışır.')
    console.log('   Smoke test:')
    console.log('     - Yeni strateji oluştur → strategy_instances.user_id dolu olmalı')
    console.log('     - GET /api/strategy/instances → yalnızca kendi stratejilerin dönmeli\n')

  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('\n❌  Migration başarısız:', err.message)
  process.exit(1)
})
