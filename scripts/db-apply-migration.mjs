// Tek migration dosyasını canlı omddq'ya uygular + doğrular. SALT additive kullanım.
// Kullanım: node scripts/db-apply-migration.mjs supabase/migrations/<dosya>.sql
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
  return { user: ui.slice(0, fc), password: ui.slice(fc + 1), host, port: Number(port), database: hp.split('/')[1] || 'postgres' }
}

const file = process.argv[2]
if (!file) { console.error('Kullanım: node scripts/db-apply-migration.mjs <sql-dosyası>'); process.exit(1) }
const sql = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const env = loadEnv()
const ca = readFileSync(new URL('./supabase-ca.pem', import.meta.url), 'utf8')
const client = new pg.Client({ ...parseDbUrl(env.SUPABASE_DB_URL), ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 15000 })

try {
  await client.connect()
  console.log('✅ Bağlandı. Migration uygulanıyor:', file)
  await client.query('begin')
  await client.query(sql)
  await client.query('commit')
  console.log('✅ Uygulandı (commit).')

  // Doğrulama: login_attempts tablosu + RLS + RPC'ler
  const t = await client.query(`select relrowsecurity from pg_class where relname='login_attempts' and relnamespace='public'::regnamespace`)
  console.log('  login_attempts RLS:', t.rows[0]?.relrowsecurity)
  const fns = await client.query(`select proname from pg_proc where proname in ('register_login_failure','clear_login_attempts')`)
  console.log('  RPC fonksiyonlar:', fns.rows.map(r => r.proname).join(', ') || 'YOK')

  // Fonksiyonel test: 2 başarısız deneme → kilit yok; sonra düşük eşikle kilit
  await client.query(`select clear_login_attempts('rl-selftest@example.com')`)
  const r1 = await client.query(`select register_login_failure('rl-selftest@example.com', 3, 900, 900) as locked`)
  const r2 = await client.query(`select register_login_failure('rl-selftest@example.com', 3, 900, 900) as locked`)
  const r3 = await client.query(`select register_login_failure('rl-selftest@example.com', 3, 900, 900) as locked`)
  console.log(`  RPC testi: 1.deneme locked=${r1.rows[0].locked} 2.=${r2.rows[0].locked} 3.(eşik)=${r3.rows[0].locked ? 'KİLİTLENDİ ✅' : 'kilitlenmedi ❌'}`)
  await client.query(`select clear_login_attempts('rl-selftest@example.com')`)
  const after = await client.query(`select count(*) from login_attempts where identifier='rl-selftest@example.com'`)
  console.log(`  clear testi: kalan kayıt=${after.rows[0].count} (0 olmalı ✅)`)
} catch (e) {
  try { await client.query('rollback') } catch {}
  console.error('❌ HATA (rollback):', e.message)
  process.exit(1)
} finally {
  await client.end()
}
