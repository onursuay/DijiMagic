/**
 * Owner — başvuruyu manuel inceleme statüsüne al.
 *
 * POST /api/admin/signups/:id/manual-review
 * Body: { note?: string }
 *
 * Aksiyon:
 *   - approval_status = 'manual_review'
 *   - manual_review_at / manual_review_by / manual_review_note güncellenir
 *   - Blocklist'e KAYIT YAZILMAZ — kullanıcı engellenmez, sadece inceleme beklenir
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkAdminAccess } from '@/lib/admin/superAdmin'

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

  let note: string | null = null
  try {
    const body = await req.json()
    note = body?.note?.trim() || null
  } catch {
    // note opsiyonel
  }

  const now = new Date().toISOString()
  const adminEmail = access.email || 'admin'

  const { error } = await supabase
    .from('signups')
    .update({
      approval_status: 'manual_review',
      manual_review_at: now,
      manual_review_by: adminEmail,
      manual_review_note: note,
      updated_at: now,
    })
    .eq('id', id)

  if (error) {
    console.error('[admin/manual-review] update error:', error.message)
    return NextResponse.json({ ok: false, error: 'update_failed', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
