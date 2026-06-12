// SALT-OKUNUR canlı DB denetim yardımcı scripti (omddq).
// Şifre özel karakter içerdiği için bağlantı string'i parse edilip bileşenlere ayrılır.
// Hiçbir sır ekrana yazılmaz; yalnız sorgu sonuçları basılır.
import { readFileSync } from 'node:fs';
import pg from 'pg';

function loadEnv() {
  const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const env = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function parseDbUrl(url) {
  // postgresql://USER:PASSWORD@HOST:PORT/DB  (PASSWORD özel karakter içerebilir → son '@'a göre ayır)
  const noScheme = url.replace(/^postgres(ql)?:\/\//, '');
  const lastAt = noScheme.lastIndexOf('@');
  const userinfo = noScheme.slice(0, lastAt);
  const hostpart = noScheme.slice(lastAt + 1);
  const firstColon = userinfo.indexOf(':');
  const user = userinfo.slice(0, firstColon);
  const password = userinfo.slice(firstColon + 1);
  const [hostPort, database = 'postgres'] = hostpart.split('/');
  const [host, port = '5432'] = hostPort.split(':');
  return { user, password, host, port: Number(port), database };
}

const env = loadEnv();
if (!env.SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL .env.local içinde yok'); process.exit(1); }
const cfg = parseDbUrl(env.SUPABASE_DB_URL);

// TLS doğrulaması AÇIK. Supabase kendi 'Supabase Root 2021 CA' zincirini kullanıyor;
// kimliği openssl ile gözle teyit edilip projeye sabitlendi (scripts/supabase-ca.pem).
const caPem = readFileSync(new URL('./supabase-ca.pem', import.meta.url), 'utf8');
const client = new pg.Client({ ...cfg, ssl: { ca: caPem, rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });

const SENSITIVE = new Set([
  'signups', 'meta_connections', 'google_ads_connections', 'tiktok_ads_connections',
  'subscriptions', 'credit_balances', 'payment_transactions', 'user_sessions',
  'crm_contacts', 'crm_leads', 'email_subscribers', 'email_contacts',
]);

try {
  await client.connect();
  const ping = await client.query('select current_database() db, current_user usr, version() v');
  console.log('✅ BAĞLANTI OK →', ping.rows[0].db, '/', ping.rows[0].usr);
  console.log('   pg:', ping.rows[0].v.split(' ').slice(0, 2).join(' '));

  const rls = await client.query(`
    select c.relname as tbl,
           c.relrowsecurity as rls_on,
           c.relforcerowsecurity as rls_forced,
           (select count(*) from pg_policy p where p.polrelid = c.oid) as policies,
           coalesce(s.n_live_tup, 0) as approx_rows
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_stat_user_tables s on s.relid = c.oid
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relrowsecurity asc, c.relname asc
  `);

  const off = rls.rows.filter(r => !r.rls_on);
  const on = rls.rows.filter(r => r.rls_on);

  console.log(`\n=== RLS DURUMU: toplam ${rls.rows.length} public tablo | RLS AÇIK ${on.length} | RLS KAPALI ${off.length} ===`);

  console.log(`\n--- 🔴 RLS KAPALI TABLOLAR (${off.length}) ---`);
  for (const r of off) {
    const flag = SENSITIVE.has(r.tbl) ? '  ⚠️ HASSAS' : '';
    console.log(`  ${r.tbl.padEnd(40)} satır~${String(r.approx_rows).padStart(7)} politika:${r.policies}${flag}`);
  }

  console.log(`\n--- 🟢 RLS AÇIK TABLOLAR (${on.length}) ---`);
  for (const r of on) {
    const noPolicy = r.policies === '0' || r.policies === 0 ? '  ⛔ RLS açık ama POLİTİKA YOK (deny-all)' : '';
    console.log(`  ${r.tbl.padEnd(40)} politika:${r.policies}${noPolicy}`);
  }

  // Hassas tabloların özel kontrolü
  console.log(`\n--- ⚠️ HASSAS TABLOLARIN ÖZETİ ---`);
  for (const t of SENSITIVE) {
    const row = rls.rows.find(r => r.tbl === t);
    if (!row) { console.log(`  ${t.padEnd(40)} (tablo yok)`); continue; }
    console.log(`  ${t.padEnd(40)} RLS:${row.rls_on ? 'AÇIK' : 'KAPALI'} politika:${row.policies} satır~${row.approx_rows}`);
  }
} catch (e) {
  console.error('❌ HATA:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
