#!/usr/bin/env node
/**
 * Stok görsel sağlayıcı doğrulaması — anahtarı tanımlı tüm sağlayıcıları (Freepik/Magnific,
 * Pexels, Unsplash, Pixabay) gerçek bir aramayla test eder. .env.local'dan okur.
 *   npm run verify:stock            (varsayılan arama)
 *   npm run verify:stock "hotel pool"
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = process.cwd()
try {
  const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {}

const term = process.argv[2] || 'modern dental clinic interior'

async function getJson(url, headers) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) })
    return { ok: res.ok, status: res.status, body: res.ok ? await res.json() : await res.text() }
  } catch (e) {
    return { ok: false, status: 0, body: e.message }
  }
}

async function freepik() {
  const key = process.env.FREEPIK_API_KEY
  if (!key) return null
  const base = process.env.FREEPIK_API_BASE || 'https://api.freepik.com'
  const header = base.includes('magnific') ? 'x-magnific-api-key' : 'x-freepik-api-key'
  const url = `${base}/v1/resources?term=${encodeURIComponent(term)}&limit=3&order=relevance&filters[content_type][photo]=1&filters[orientation][landscape]=1`
  const r = await getJson(url, { [header]: key, 'Accept-Language': 'en-US' })
  const photos = r.ok && Array.isArray(r.body?.data) ? r.body.data.filter((x) => x?.image?.source?.url) : []
  return { name: `Freepik/Magnific (${header})`, ok: r.ok, status: r.status, count: photos.length, sample: photos[0]?.image?.source?.url, err: r.ok ? null : String(r.body).slice(0, 180) }
}

async function pexels() {
  const key = process.env.PEXELS_API_KEY
  if (!key) return null
  const r = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=3&orientation=landscape`, { Authorization: key })
  const photos = r.ok && Array.isArray(r.body?.photos) ? r.body.photos : []
  return { name: 'Pexels', ok: r.ok, status: r.status, count: photos.length, sample: photos[0]?.src?.large, err: r.ok ? null : String(r.body).slice(0, 180) }
}

async function unsplash() {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return null
  const r = await getJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(term)}&per_page=3&orientation=landscape`, { Authorization: `Client-ID ${key}` })
  const photos = r.ok && Array.isArray(r.body?.results) ? r.body.results : []
  return { name: 'Unsplash', ok: r.ok, status: r.status, count: photos.length, sample: photos[0]?.urls?.regular, err: r.ok ? null : String(r.body).slice(0, 180) }
}

async function pixabay() {
  const key = process.env.PIXABAY_API_KEY
  if (!key) return null
  const r = await getJson(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(term)}&image_type=photo&orientation=horizontal&per_page=3`)
  const photos = r.ok && Array.isArray(r.body?.hits) ? r.body.hits : []
  return { name: 'Pixabay', ok: r.ok, status: r.status, count: photos.length, sample: photos[0]?.largeImageURL, err: r.ok ? null : String(r.body).slice(0, 180) }
}

console.log(`\n🔎  Stok testi — arama: "${term}"\n`)
const results = (await Promise.all([freepik(), pexels(), unsplash(), pixabay()])).filter(Boolean)
if (results.length === 0) {
  console.log('⚠️  Hiç sağlayıcı anahtarı yok (.env.local). En az birini ekle: FREEPIK_API_KEY / PEXELS_API_KEY / UNSPLASH_ACCESS_KEY / PIXABAY_API_KEY\n')
  process.exit(0)
}
let anyOk = false
for (const r of results) {
  if (r.ok && r.count > 0) {
    anyOk = true
    console.log(`✓  ${r.name}: ${r.count} foto — ör. ${r.sample}`)
  } else {
    console.log(`✗  ${r.name}: HTTP ${r.status} ${r.err ? '— ' + r.err : '(sonuç yok)'}`)
  }
}
console.log(anyOk ? '\n✓  En az bir sağlayıcı çalışıyor — siteler görsel kullanacak.\n' : '\n❌  Çalışan sağlayıcı yok.\n')
process.exit(anyOk ? 0 : 1)
