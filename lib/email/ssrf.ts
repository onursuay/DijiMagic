import 'server-only'
import { promises as dns } from 'node:dns'
import net from 'node:net'

/**
 * SSRF koruması — kullanıcı tarafından verilen SMTP host'una bağlanmadan önce
 * doğrula. Host'u DNS ile çözüp dahili/özel adres aralıklarını reddeder; port'u
 * SMTP allowlist'ine sınırlar. Böylece iç servisler / cloud metadata (169.254…)
 * hedeflenemez.
 */

const ALLOWED_PORTS = new Set([25, 465, 587, 2525])

function isPrivateV4(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = p
  if (a === 0 || a === 127) return true // unspecified / loopback
  if (a === 10) return true // 10/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
  if (a === 192 && b === 168) return true // 192.168/16
  if (a === 169 && b === 254) return true // link-local (metadata!)
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
  if (a >= 224) return true // multicast / reserved
  return false
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true // loopback / unspecified
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true // fe80::/10 link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // fc00::/7 unique-local
  if (lower.startsWith('ff')) return true // multicast
  const m = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/) // IPv4-mapped
  if (m) return isPrivateV4(m[1])
  return false
}

const isUnsafeIp = (ip: string, family: number) => (family === 4 ? isPrivateV4(ip) : isPrivateV6(ip))

/** Host güvenli (dış, dahili olmayan) ve port izinli mi? */
export async function assertSafeSmtpHost(host: string, port: number): Promise<{ ok: boolean; reason?: string }> {
  if (!ALLOWED_PORTS.has(Number(port))) return { ok: false, reason: 'port_not_allowed' }
  const h = (host || '').trim()
  if (!h) return { ok: false, reason: 'no_host' }

  // Doğrudan IP girilmişse
  const ipFam = net.isIP(h)
  if (ipFam) {
    return isUnsafeIp(h, ipFam) ? { ok: false, reason: 'private_host' } : { ok: true }
  }

  // Hostname → tüm A/AAAA kayıtlarını çöz, herhangi biri dahili ise reddet
  try {
    const addrs = await dns.lookup(h, { all: true })
    if (!addrs.length) return { ok: false, reason: 'no_resolve' }
    for (const a of addrs) {
      if (isUnsafeIp(a.address, a.family)) return { ok: false, reason: 'private_host' }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'resolve_failed' }
  }
}
