// Sosyal Medya Yönetimi medya deposu (Supabase Storage) bucket'ını oluşturur (idempotent).
// Kullanım: node scripts/setup-social-media-storage.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const env = {}
  for (const line of txt.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
  return env
}

const env = loadEnv()
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY
const BUCKET = 'social-media'

if (!url || !key) { console.error('❌ SUPABASE_URL / SERVICE_KEY eksik'); process.exit(1) }

const supabase = createClient(url, key)

try {
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets()
  if (listErr) throw listErr
  const exists = (buckets || []).some(b => b.name === BUCKET)
  if (exists) {
    console.log(`✅ Bucket zaten var: ${BUCKET}`)
  } else {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'],
    })
    if (error) throw error
    console.log(`✅ Bucket oluşturuldu (public): ${BUCKET}`)
  }
  const { data: after } = await supabase.storage.listBuckets()
  const row = (after || []).find(b => b.name === BUCKET)
  console.log('  public:', row?.public, '| id:', row?.id)
} catch (e) {
  console.error('❌ HATA:', e.message)
  process.exit(1)
}
