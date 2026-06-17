// Sosyal Medya Yönetimi tablolarını canlı omddq'ya uygular + doğrular. SALT additive.
// Kullanım: node scripts/apply-social-media-migration.mjs
import { readFileSync } from 'node:fs'
import pg from 'pg'

function loadEnv() {
  const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const env = {}
  for (const line of txt.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
  return env
}
function parseDbUrl(url) {
  const ns = url.replace(/^postgres(ql)?:\/\//, ''); const at = ns.lastIndexOf('@')
  const ui = ns.slice(0, at), hp = ns.slice(at + 1); const fc = ui.indexOf(':')
  const [host, port = '5432'] = hp.split('/')[0].split(':')
  return { user: ui.slice(0, fc), password: ui.slice(fc + 1), host, port: Number(port), database: hp.split('/')[1]?.split('?')[0] || 'postgres' }
}

const FILE = process.argv[2] || 'supabase/migrations/20260617000000_create_social_media_tables.sql'
const sql = readFileSync(new URL('../' + FILE, import.meta.url), 'utf8')
const env = loadEnv()
const ca = readFileSync(new URL('./supabase-ca.pem', import.meta.url), 'utf8')
const client = new pg.Client({ ...parseDbUrl(env.SUPABASE_DB_URL), ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 15000 })

try {
  await client.connect()
  console.log('✅ Bağlandı. Migration uygulanıyor:', FILE)
  await client.query('begin')
  await client.query(sql)
  await client.query('commit')
  console.log('✅ Uygulandı (commit).')

  const t = await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_name like 'social_%' order by 1"
  )
  console.log('  Tablolar:', t.rows.map(r => r.table_name).join(', ') || 'YOK')
  for (const tbl of ['social_projects', 'social_scheduled_posts', 'social_post_targets', 'social_post_media']) {
    const r = await client.query(`select relrowsecurity from pg_class where relname=$1 and relnamespace='public'::regnamespace`, [tbl])
    console.log(`  ${tbl} RLS:`, r.rows[0]?.relrowsecurity)
  }
} catch (e) {
  try { await client.query('rollback') } catch {}
  console.error('❌ HATA (rollback):', e.message)
  process.exit(1)
} finally {
  await client.end()
}
