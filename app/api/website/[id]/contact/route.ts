import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { notifySiteOwnerOfContact } from '@/lib/website/contactNotify'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

/**
 * PUBLIC — üretilen sitenin iletişim formu gönderimi. Auth YOK (ziyaretçi gönderir).
 * Spam koruması: gizli honeypot (`website`) + zorunlu alan/format doğrulaması + basit IP rate-limit
 * (best-effort; serverless warm instance) + gövde boyutu sınırı.
 * Mesaj site sahibinin e-postasına iletilir (signups.email where id = website.user_id).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Basit in-memory rate-limit: IP başına 60 sn'de en fazla 5 gönderim (warm instance).
const RL = new Map<string, number[]>()
const RL_WINDOW_MS = 60_000
const RL_MAX = 5
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (RL.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS)
  if (arr.length >= RL_MAX) { RL.set(ip, arr); return true }
  arr.push(now)
  RL.set(ip, arr)
  if (RL.size > 5000) RL.clear() // sınırsız büyümeyi engelle
  return false
}
function clientIp(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim()
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Gövde boyutu sınırı (form için 20KB fazlasıyla yeterli)
    const cl = Number(req.headers.get('content-length') || 0)
    if (cl > 20_000) return NextResponse.json({ ok: false }, { status: 413 })
    if (rateLimited(clientIp(req))) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
    const name = s(body.name, 120)
    const email = s(body.email, 160)
    const phone = s(body.phone, 40)
    const message = s(body.message, 4000)
    const honeypot = s(body.website, 200)

    // Bot honeypot'u doldurdu → sessiz başarı (botu uyarmadan ele)
    if (honeypot) return NextResponse.json({ ok: true })
    if (!name || !EMAIL_RE.test(email) || message.length < 2) {
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
    }
    if (!supabase) return NextResponse.json({ ok: false }, { status: 503 })

    const { data: site } = await supabase
      .from('websites')
      .select('user_id, label')
      .eq('id', params.id)
      .maybeSingle()
    if (!site) return NextResponse.json({ ok: false }, { status: 404 })

    const { data: owner } = await supabase
      .from('signups')
      .select('email')
      .eq('id', (site as { user_id: string }).user_id)
      .maybeSingle()
    const ownerEmail = (owner as { email?: string } | null)?.email
    if (!ownerEmail) return NextResponse.json({ ok: false, error: 'no_owner' }, { status: 500 })

    const sent = await notifySiteOwnerOfContact(
      ownerEmail,
      (site as { label?: string }).label || 'Web Sitesi',
      { name, email, phone, message },
    )
    return NextResponse.json({ ok: sent }, { status: sent ? 200 : 502 })
  } catch (e) {
    console.error('[website:contact]', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
