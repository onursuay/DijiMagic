// smoke-reconcile.mjs — gerçek-DB smoke testi (opsiyonel, .env.local ister)
// Kullanım: node scripts/smoke-reconcile.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')
try { require('dotenv').config({ path: '.env.local' }) } catch {}
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.log('SKIP'); process.exit(0) }
const db = createClient(url, key)
const { data: sites } = await db.from('websites').select('id,user_id').limit(1)
if (!sites?.length) { console.log('SKIP'); process.exit(0) }
const { data: ins } = await db.from('website_gen_jobs')
  .insert({ website_id: sites[0].id, user_id: sites[0].user_id, status: 'queued', stage: 'queued', progress: 0, locales: ['tr'], site_type: 'landing' })
  .select('id').single()
const cutoff = new Date(Date.now() - 0).toISOString()
await db.from('website_gen_jobs').update({ status: 'timeout', error_reason: 'reconcile:stale', completed_at: new Date().toISOString() })
  .in('status', ['queued', 'running']).lt('updated_at', cutoff).eq('id', ins.id)
const { data: g } = await db.from('website_gen_jobs').select('status').eq('id', ins.id).single()
assert.equal(g.status, 'timeout', 'FAIL: stale reconcile edilmedi')
await db.from('website_gen_jobs').delete().eq('id', ins.id)
console.log('smoke-reconcile OK')
