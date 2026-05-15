/**
 * Owner — başvuru engelleme.
 *
 * POST /api/admin/signups/:id/block
 * Body: {
 *   blockTypes: ('user' | 'email' | 'domain' | 'ip')[]  -- en az 1
 *   reason?: string
 *   sourceIp?: string  -- client'tan iletilmesi tercih edilir; yoksa null kalır
 * }
 *
 * Aksiyon:
 *   - signups.approval_status = 'blocked'
 *   - signups.blocked_at / blocked_by / block_reason güncellenir
 *   - Seçilen block_type'lar signup_blocklist'e eklenir
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkAdminAccess } from '@/lib/admin/superAdmin'
import { addToBlocklist, extractDomain } from '@/lib/admin/blocklist'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkAdminAccess(req)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_unavailable' }, { status: 503 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  let body: { blockTypes?: string[]; reason?: string; sourceIp?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const { blockTypes = ['user'], reason, sourceIp } = body

  const VALID_TYPES = ['user', 'email', 'domain', 'ip'] as const
  const selectedTypes = blockTypes.filter((t): t is (typeof VALID_TYPES)[number] =>
    VALID_TYPES.includes(t as any),
  )
  if (selectedTypes.length === 0) {
    return NextResponse.json({ ok: false, error: 'block_type_required' }, { status: 400 })
  }

  // Kaydı çek — email ve diğer alanlar için
  const { data: signup, error: fetchErr } = await supabase
    .from('signups')
    .select('id, email')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !signup) {
    return NextResponse.json({ ok: false, error: 'signup_not_found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const adminEmail = access.email || 'admin'

  // signups tablosunu güncelle
  const { error: updateErr } = await supabase
    .from('signups')
    .update({
      approval_status: 'blocked',
      blocked_at: now,
      blocked_by: adminEmail,
      block_reason: reason?.trim() || null,
      updated_at: now,
    })
    .eq('id', id)

  if (updateErr) {
    console.error('[admin/block] signups update error:', updateErr.message)
    return NextResponse.json({ ok: false, error: 'update_failed', message: updateErr.message }, { status: 500 })
  }

  // Blocklist kayıtları ekle
  const blocklists = []
  for (const t of selectedTypes) {
    if (t === 'user') {
      blocklists.push({ block_type: 'user' as const, value: id, signup_id: id, reason: reason?.trim() || null, created_by: adminEmail })
    } else if (t === 'email' && signup.email) {
      blocklists.push({ block_type: 'email' as const, value: (signup.email as string).toLowerCase(), signup_id: id, reason: reason?.trim() || null, created_by: adminEmail })
    } else if (t === 'domain' && signup.email) {
      const domain = extractDomain(signup.email as string)
      if (domain) {
        blocklists.push({ block_type: 'domain' as const, value: domain, signup_id: id, reason: reason?.trim() || null, created_by: adminEmail })
      }
    } else if (t === 'ip') {
      const ip = sourceIp?.trim() || null
      if (ip) {
        blocklists.push({ block_type: 'ip' as const, value: ip, signup_id: id, reason: reason?.trim() || null, created_by: adminEmail, source_ip: ip })
      } else {
        console.warn('[admin/block] IP block requested but no sourceIp provided for signup:', id)
      }
    }
  }

  if (blocklists.length > 0) {
    await addToBlocklist(blocklists)
  }

  return NextResponse.json({ ok: true, blockedTypes: selectedTypes })
}
