import { NextResponse, type NextRequest } from 'next/server'
import { getPublishedSiteBySubdomain, getOwnerEmailByUserId } from '@/lib/website/store'
import { notifySiteOwnerOfContact } from '@/lib/website/contactNotify'
import { SITE_CSP } from '@/lib/website/render/serveCommon'

export const dynamic = 'force-dynamic'

/**
 * PUBLIC iletişim formu uç noktası — üretilen sitenin AYNI köken (same-origin)
 * altında çalışan lead POST'u: `/s/<subdomain>/lead`.
 *
 * Akış:
 *   1. JSON gövdeyi ayrıştır {name,email,phone,message,company(honeypot)}.
 *   2. Doğrula: name/email/message zorunlu; email regex; uzunluk sınırları.
 *      Honeypot (`company`) DOLU ise → 200 {ok:true} (sessiz bot drop, e-posta YOK).
 *   3. Basit hız sınırı (IP başına, in-memory token bucket; 5/dk). Aşımda → 429.
 *   4. Subdomain → yayınlanmış site → user_id → ownerEmail = signups.email.
 *   5. notifySiteOwnerOfContact (Resend; CRLF/HTML kaçışını O yapar). Kabul edilirse
 *      {ok:true} (e-posta gönderimi false dönse bile — teslim durumu sızdırılmaz).
 *
 * Kimlik doğrulama YOK (public iletişim formu) — honeypot + hız sınırı spam'i tutar.
 * Güvenlik girdiyi sunucu tarafında uzunlukla kısar; içerik kaçışı contactNotify'da.
 */

// ── Girdi sınırları (sunucu tarafı — istemci doğrulamasına güvenilmez) ──────
const MAX_NAME = 200
const MAX_EMAIL = 320
const MAX_PHONE = 40
const MAX_MESSAGE = 5000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Basit in-memory hız sınırı (IP başına token bucket): 5 istek / 60 sn ────
// Vercel'de fonksiyon örneği başına geçerli; tam dağıtık bir kota değil ama bot/
// spam selini tek başına ciddi şekilde kısar (honeypot ile birlikte yeterli savunma).
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const rateBuckets = new Map<string, number[]>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (rateBuckets.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (hits.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(key, hits) // pencere içi vuruşları koru
    return true
  }
  hits.push(now)
  rateBuckets.set(key, hits)
  // Bellek sızıntısını önle: ara sıra eski anahtarları temizle.
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (v.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) rateBuckets.delete(k)
    }
  }
  return false
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

function jsonHeaders(): Record<string, string> {
  // Aynı CSP defense-in-depth (serveCommon ile birebir). next.config zaten
  // `/s/:path*` için uygular; burada response başlığına da yazıyoruz.
  return {
    'content-type': 'application/json; charset=utf-8',
    'Content-Security-Policy': SITE_CSP,
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { subdomain: string } },
): Promise<NextResponse> {
  const headers = jsonHeaders()

  // ── Hız sınırı (önce — pahalı işlerden kaçın) ─────────────────────────────
  const rlKey = `${params.subdomain}:${clientIp(req)}`
  if (isRateLimited(rlKey)) {
    return new NextResponse(JSON.stringify({ ok: false, error: 'rate_limited' }), {
      status: 429,
      headers,
    })
  }

  // ── Gövdeyi ayrıştır ───────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new NextResponse(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers,
    })
  }
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

  const name = str(b.name)
  const email = str(b.email)
  const phone = str(b.phone)
  const message = str(b.message)
  const company = str(b.company) // honeypot

  // ── Honeypot: dolu ise sessiz bot drop (200, e-posta GÖNDERME) ────────────
  if (company !== '') {
    return new NextResponse(JSON.stringify({ ok: true }), { status: 200, headers })
  }

  // ── Doğrulama ──────────────────────────────────────────────────────────────
  if (
    !name || name.length > MAX_NAME ||
    !email || email.length > MAX_EMAIL || !EMAIL_RE.test(email) ||
    phone.length > MAX_PHONE ||
    !message || message.length > MAX_MESSAGE
  ) {
    return new NextResponse(JSON.stringify({ ok: false, error: 'invalid_input' }), {
      status: 400,
      headers,
    })
  }

  // ── Siteyi çöz → sahip e-postası ───────────────────────────────────────────
  let ownerEmail: string | null = null
  let siteName = 'Web Sitesi'
  try {
    const site = await getPublishedSiteBySubdomain(params.subdomain)
    if (site) {
      siteName = site.website.label || siteName
      ownerEmail = await getOwnerEmailByUserId(site.website.userId)
    }
  } catch (e) {
    // Site çözümleme hatası iç durumdur — teslim durumunu sızdırma; yine kabul et.
    console.error('[lead] site resolve hatası:', e instanceof Error ? e.message : e)
  }

  // ── E-postayı gönder (en iyi çaba). contactNotify CRLF/HTML kaçışını yapar. ──
  // ownerEmail yoksa / RESEND_API_KEY yoksa false döner → form yine başarı görür
  // (graceful), e-posta no-op olur. Teslim durumunu public'e sızdırma.
  try {
    if (ownerEmail) {
      const sent = await notifySiteOwnerOfContact(ownerEmail, siteName, {
        name,
        email,
        phone,
        message,
      })
      if (!sent) {
        console.warn(`[lead] e-posta gönderilemedi (subdomain=${params.subdomain})`)
      }
    } else {
      console.warn(`[lead] sahip e-postası yok (subdomain=${params.subdomain}) — e-posta no-op`)
    }
  } catch (e) {
    console.error('[lead] gönderim hatası:', e instanceof Error ? e.message : e)
  }

  return new NextResponse(JSON.stringify({ ok: true }), { status: 200, headers })
}
