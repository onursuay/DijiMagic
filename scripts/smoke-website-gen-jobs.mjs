#!/usr/bin/env node
/**
 * Smoke test: website_gen_jobs tablosu CRUD doğrulaması.
 * Gerçek DB'ye yazar/okur/temizler. .env.local ister — CI'da koşmaz.
 * Kullanım: node scripts/smoke-website-gen-jobs.mjs
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// .env.local yükle (dotenv yoksa process.env zaten Vercel/CI'da dolu)
try { require('dotenv').config({ path: '.env.local' }) } catch {}

const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.log('SKIP smoke (no supabase env)'); process.exit(0) }

const db = createClient(url, key)

// Geçerli bir website_id gerek (FK). Var olan ilk siteyi al; yoksa SKIP.
const { data: sites } = await db.from('websites').select('id,user_id').limit(1)
if (!sites?.length) { console.log('SKIP smoke (no website row)'); process.exit(0) }
const { id: websiteId, user_id: userId } = sites[0]

// 1. INSERT + doğrula
const { data: ins, error: e1 } = await db
  .from('website_gen_jobs')
  .insert({
    website_id: websiteId,
    user_id: userId,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    locales: ['tr'],
    site_type: 'landing',
  })
  .select('id,status,progress')
  .single()
assert.ok(!e1 && ins.status === 'queued' && ins.progress === 0, `FAIL insert queued/0: ${e1?.message}`)

// 2. UPDATE stage + progress
const { error: e2 } = await db
  .from('website_gen_jobs')
  .update({ stage: 'building_page', progress: 40 })
  .eq('id', ins.id)
assert.ok(!e2, `FAIL update stage/progress: ${e2?.message}`)

const { data: g } = await db
  .from('website_gen_jobs')
  .select('stage,progress')
  .eq('id', ins.id)
  .single()
assert.ok(g.stage === 'building_page' && g.progress === 40, 'FAIL stage/progress read-back')

// 3. Temizle
await db.from('website_gen_jobs').delete().eq('id', ins.id)

console.log('smoke-website-gen-jobs OK')
