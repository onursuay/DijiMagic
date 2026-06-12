// KONTROLLÜ + TEYİTLİ RLS düzeltmesi (omddq canlı).
// Kanarya tablo önce: service-role hâlâ okuyor + anon engelleniyor doğrulanır.
// Kanarya geçmezse diğer 6 tabloya DOKUNULMAZ.
import { readFileSync } from 'node:fs';
import pg from 'pg';

function loadEnv() {
  const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const env = {};
  for (const line of txt.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
  return env;
}
function parseDbUrl(url) {
  const noScheme = url.replace(/^postgres(ql)?:\/\//, '');
  const lastAt = noScheme.lastIndexOf('@');
  const userinfo = noScheme.slice(0, lastAt), hostpart = noScheme.slice(lastAt + 1);
  const fc = userinfo.indexOf(':');
  const [hostPort, database = 'postgres'] = hostpart.split('/');
  const [host, port = '5432'] = hostPort.split(':');
  return { user: userinfo.slice(0, fc), password: userinfo.slice(fc + 1), host, port: Number(port), database };
}

const env = loadEnv();
const cfg = parseDbUrl(env.SUPABASE_DB_URL);
const REST = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ca = readFileSync(new URL('./supabase-ca.pem', import.meta.url), 'utf8');

const CANARY = 'report_cache';
const REST_TABLES = ['meta_connections','google_ads_connections','google_analytics_connections','google_search_console_connections','signups','strategy_templates'];

// REST okuma testi → { status, bytes, rows }
async function restRead(table, key) {
  const r = await fetch(`${REST}/rest/v1/${table}?select=*&limit=1`, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  const body = await r.text();
  return { status: r.status, bytes: body.length, hasData: r.status === 200 && body.length > 2 };
}
async function report(table) {
  const svc = await restRead(table, SERVICE);
  const anon = await restRead(table, ANON);
  const svcOk = svc.hasData || svc.status === 200; // service her zaman 200; veri olmayabilir (0 satır tablo)
  const anonBlocked = !anon.hasData;
  console.log(`  ${table.padEnd(36)} service:${svc.status}${svc.hasData?'+veri':'(boş/0satır)'}  anon:${anon.status}${anon.hasData?' 🔴SIZIYOR':' ✅engellendi'}`);
  return { svcOk, anonBlocked, svcHasData: svc.hasData };
}

const client = new pg.Client({ ...cfg, ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  console.log('✅ Bağlandı (postgres)\n');

  // --- AŞAMA 0: ÖNCE durum ---
  console.log('=== AŞAMA 0 — DÜZELTME ÖNCESİ durum ===');
  const beforeCanary = await report(CANARY);
  for (const t of REST_TABLES) await report(t);

  // --- AŞAMA 1: KANARYA ---
  console.log(`\n=== AŞAMA 1 — KANARYA: ${CANARY} üzerinde RLS aç ===`);
  await client.query(`ALTER TABLE public.${CANARY} ENABLE ROW LEVEL SECURITY`);
  console.log(`  ALTER çalıştı. Doğrulanıyor…`);
  const afterCanary = await report(CANARY);

  // Kanarya kabul kriteri: anon artık engellenmiş olmalı; service hâlâ erişebilmeli.
  // (report_cache'in verisi vardı; service hâlâ veri görmeli)
  const canaryPass = afterCanary.anonBlocked && afterCanary.svcOk;
  if (!canaryPass) {
    console.log(`\n❌ KANARYA BAŞARISIZ — anonBlocked=${afterCanary.anonBlocked} svcOk=${afterCanary.svcOk}. GERİ ALINIYOR ve diğer tablolara DOKUNULMUYOR.`);
    await client.query(`ALTER TABLE public.${CANARY} DISABLE ROW LEVEL SECURITY`);
    console.log('  Kanarya geri alındı (DISABLE RLS). Hiçbir kalıcı değişiklik yok.');
    process.exit(2);
  }
  console.log(`  ✅ KANARYA GEÇTİ: anon engellendi, service erişimi korundu. Service-role baypas çalışıyor → uygulama etkilenmez.`);

  // --- AŞAMA 2: KALAN 6 TABLO ---
  console.log(`\n=== AŞAMA 2 — Kalan ${REST_TABLES.length} tabloda RLS aç ===`);
  for (const t of REST_TABLES) {
    await client.query(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`);
    console.log(`  ✓ ${t}`);
  }

  // --- AŞAMA 3: SON DOĞRULAMA ---
  console.log(`\n=== AŞAMA 3 — SON DOĞRULAMA (7 tablo) ===`);
  let allBlocked = true, allSvcOk = true;
  for (const t of [CANARY, ...REST_TABLES]) {
    const r = await report(t);
    if (!r.anonBlocked) allBlocked = false;
    if (!r.svcOk) allSvcOk = false;
  }
  console.log(`\n${allBlocked ? '✅' : '❌'} Tüm 7 tablo anon'a kapalı: ${allBlocked}`);
  console.log(`${allSvcOk ? '✅' : '❌'} Service-role erişimi (uygulama yolu) korundu: ${allSvcOk}`);
  if (allBlocked && allSvcOk) console.log('\n🎉 SIZINTI KAPATILDI. Uygulama service-role ile çalışmaya aynen devam eder.');
} catch (e) {
  console.error('❌ HATA:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
