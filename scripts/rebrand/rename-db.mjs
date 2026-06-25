#!/usr/bin/env node
// Faz 3 — Canlı DB RENAME: tüm yoai-adlı nesneleri dijimagic'e çevir.
// Dinamik (katalogdan), tek transaction, doğrulama temiz değilse ROLLBACK.
import { connect } from './_db.mjs'

const RENAME = `DO $$
DECLARE r record;
BEGIN
  -- 1) Tablolar (composite + array tipleri otomatik döner)
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'yoai%' LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME TO %I', r.tablename, replace(r.tablename,'yoai','dijimagic'));
  END LOOP;
  -- 2) Kolonlar
  FOR r IN SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema='public' AND column_name LIKE '%yoai%' LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', r.table_name, r.column_name, replace(r.column_name,'yoai','dijimagic'));
  END LOOP;
  -- 3) Constraint'ler (pkey/unique/fkey/check) — backing index ile birlikte döner
  FOR r IN SELECT conname, conrelid::regclass::text AS tbl FROM pg_constraint WHERE conname LIKE '%yoai%' LOOP
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', r.tbl, r.conname, replace(r.conname,'yoai','dijimagic'));
  END LOOP;
  -- 4) Kalan (constraint-dışı) index'ler
  FOR r IN SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%yoai%' LOOP
    EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.indexname, replace(r.indexname,'yoai','dijimagic'));
  END LOOP;
  -- 5) RLS policy'ler (tablename rename sonrası güncel)
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' AND policyname LIKE '%yoai%' LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I RENAME TO %I', r.policyname, r.tablename, replace(r.policyname,'yoai','dijimagic'));
  END LOOP;
  -- 6) Trigger'lar
  FOR r IN SELECT tgname, tgrelid::regclass::text AS tbl FROM pg_trigger WHERE tgname LIKE '%yoai%' AND NOT tgisinternal LOOP
    EXECUTE format('ALTER TRIGGER %I ON %s RENAME TO %I', r.tgname, r.tbl, replace(r.tgname,'yoai','dijimagic'));
  END LOOP;
  -- 7) Function'lar
  FOR r IN SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname LIKE '%yoai%' LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', r.proname, r.args, replace(r.proname,'yoai','dijimagic'));
  END LOOP;
  -- 8) ai_engine_runs.platform değeri + CHECK (yoalgoritma_hier -> dijialgoritma_hier)
  ALTER TABLE public.ai_engine_runs DROP CONSTRAINT IF EXISTS ai_engine_runs_platform_check;
  UPDATE public.ai_engine_runs SET platform='dijialgoritma_hier' WHERE platform='yoalgoritma_hier';
  ALTER TABLE public.ai_engine_runs
    ADD CONSTRAINT ai_engine_runs_platform_check CHECK (platform IN ('Meta','Google','dijialgoritma_hier'));
END $$;`

const VERIFY = `SELECT
  (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%yoai%') AS tables,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name LIKE '%yoai%') AS columns,
  (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%yoai%') AS indexes,
  (SELECT count(*) FROM pg_constraint WHERE conname LIKE '%yoai%') AS constraints,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname LIKE '%yoai%') AS policies,
  (SELECT count(*) FROM pg_trigger WHERE tgname LIKE '%yoai%' AND NOT tgisinternal) AS triggers,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE '%yoai%') AS functions,
  (SELECT count(*) FROM pg_type WHERE typname LIKE '%yoai%') AS types,
  (SELECT count(*) FROM ai_engine_runs WHERE platform LIKE '%yoalgoritma%') AS ai_old_platform,
  (SELECT count(*) FROM ai_engine_runs WHERE platform='dijialgoritma_hier') AS ai_new_platform`

const client = await connect()
try {
  await client.query('BEGIN')
  await client.query(RENAME)
  const v = (await client.query(VERIFY)).rows[0]
  const residual = ['tables','columns','indexes','constraints','policies','triggers','functions','types','ai_old_platform']
    .reduce((s,k)=>s+Number(v[k]),0)
  console.log('DOĞRULAMA:', JSON.stringify(v))
  if (residual === 0) {
    await client.query('COMMIT')
    console.log(`✅ COMMIT — sıfır yoai DB nesnesi kaldı. ai_engine dijialgoritma_hier satır: ${v.ai_new_platform}`)
  } else {
    await client.query('ROLLBACK')
    console.error(`❌ ROLLBACK — ${residual} yoai nesnesi hâlâ var (yukarıdaki sayıma bak). Değişiklik geri alındı.`)
    process.exit(1)
  }
} catch (e) {
  await client.query('ROLLBACK').catch(()=>{})
  console.error('❌ HATA → ROLLBACK:', e.message)
  process.exit(1)
} finally {
  await client.end()
}
