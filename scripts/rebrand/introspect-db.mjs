#!/usr/bin/env node
// Faz 3 — SALT-OKUNUR: canlı DB'deki tüm yoai-adlı nesneleri enumere et.
import { connect } from './_db.mjs'

const Q = {
  tables: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename ILIKE '%yoai%' ORDER BY 1`,
  columns: `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name ILIKE '%yoai%' ORDER BY 1,2`,
  indexes: `SELECT indexname, tablename FROM pg_indexes WHERE schemaname='public' AND indexname ILIKE '%yoai%' ORDER BY 1`,
  constraints: `SELECT conname, conrelid::regclass::text AS tbl FROM pg_constraint WHERE conname ILIKE '%yoai%' ORDER BY 1`,
  policies: `SELECT policyname, tablename FROM pg_policies WHERE policyname ILIKE '%yoai%' ORDER BY 2,1`,
  triggers: `SELECT tgname, tgrelid::regclass::text AS tbl FROM pg_trigger WHERE tgname ILIKE '%yoai%' AND NOT tgisinternal ORDER BY 1`,
  functions: `SELECT proname FROM pg_proc WHERE proname ILIKE '%yoai%' ORDER BY 1`,
  sequences: `SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' AND sequence_name ILIKE '%yoai%' ORDER BY 1`,
  types: `SELECT typname FROM pg_type WHERE typname ILIKE '%yoai%' ORDER BY 1`,
  views: `SELECT table_name FROM information_schema.views WHERE table_schema='public' AND table_name ILIKE '%yoai%' ORDER BY 1`,
  ai_engine_platform: `SELECT platform, count(*)::int AS n FROM ai_engine_runs GROUP BY platform ORDER BY 1`,
  ai_engine_check: `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='ai_engine_runs'::regclass AND contype='c'`,
}

const client = await connect()
const out = {}
for (const [k, sql] of Object.entries(Q)) {
  try { out[k] = (await client.query(sql)).rows } catch (e) { out[k] = { _error: e.message } }
}
await client.end()
console.log(JSON.stringify(out, null, 2))
