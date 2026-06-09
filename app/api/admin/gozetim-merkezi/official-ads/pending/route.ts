/**
 * GET /api/admin/gozetim-merkezi/official-ads/pending
 * review_required resmi bilgi taslaklarını + yürürlükteki versiyonu (diff) döner.
 * Yetkisiz → 404 (admin alanının varlığı sızdırılmaz).
 */
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkAdminAccess } from '@/lib/admin/superAdmin'
import { listPendingKnowledge } from '@/lib/yoai/officialAdsKnowledgeDecision'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const access = await checkAdminAccess(req)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_unavailable' }, { status: 503 })
  }
  try {
    const entries = await listPendingKnowledge(supabase)
    return NextResponse.json({ ok: true, entries })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
