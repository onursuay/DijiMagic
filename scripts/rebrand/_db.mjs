// Ortak DB bağlantı helper'ı — SUPABASE_DB_URL özel-karakterli şifre içerir,
// URL parse EDİLEMEZ. Son '@'yi sınır alarak alan-bazlı (user/password/host/port/db) bağlanır.
// Şifre ASLA loglanmaz.
import { readFileSync } from 'fs'
import { resolve } from 'path'
import pg from 'pg'

export function loadEnv() {
  try {
    const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of env.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m && !(m[1].trim() in process.env)) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}

export function parseConn(url) {
  const s = url.replace(/^postgres(ql)?:\/\//, '')
  const at = s.lastIndexOf('@')                 // şifredeki @'leri tolere et
  const creds = s.slice(0, at)
  let hostpart = s.slice(at + 1)
  const ci = creds.indexOf(':')
  const user = creds.slice(0, ci)
  const password = creds.slice(ci + 1)          // RAW (URL-encoded değil)
  const slash = hostpart.indexOf('/')
  const hostport = hostpart.slice(0, slash)
  const database = hostpart.slice(slash + 1).split('?')[0]
  const ci2 = hostport.lastIndexOf(':')
  const host = hostport.slice(0, ci2)
  const port = parseInt(hostport.slice(ci2 + 1), 10)
  // SSL: Supabase Root 2021 CA pinlenir → TLS doğrulama AÇIK (rejectUnauthorized:true), MITM koruması var.
  const ca = readFileSync(resolve(process.cwd(), 'scripts/rebrand/supabase-ca-clean.pem'), 'utf8')
  return { user, password, host, port, database, ssl: { ca, rejectUnauthorized: true } }
}

export async function connect() {
  loadEnv()
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!url) throw new Error('SUPABASE_DB_URL/DATABASE_URL yok')
  const cfg = parseConn(url)
  const client = new pg.Client(cfg)
  await client.connect()
  return client
}
