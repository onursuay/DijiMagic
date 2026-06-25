/**
 * POST /api/admin/gozetim-merkezi/official-ads/decision
 * Body: { itemId: string, decision: 'approve' | 'reject' }
 * approve: önceki versiyonu emekliye ayır + onayla; reject: deprecated.
 * Onay/ret sonrası knowledge cache temizlenir (canlıya anında yansır).
 * Yetkisiz → 404.
 */
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkAdminAccess } from '@/lib/admin/superAdmin'
import { approveKnowledgeItem, rejectKnowledgeItem } from '@/lib/dijimagic/officialAdsKnowledgeDecision'
import { clearKnowledgeCache } from '@/lib/dijimagic/officialAdsKnowledgeStore'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const access = await checkAdminAccess(req)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_unavailable' }, { status: 503 })
  }

  let body: { itemId?: unknown; decision?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const id = typeof body.itemId === 'string' ? body.itemId : ''
  const decision = body.decision
  if (!id || (decision !== 'approve' && decision !== 'reject')) {
    return NextResponse.json({ ok: false, error: 'invalid_params' }, { status: 400 })
  }

  const result =
    decision === 'approve'
      ? await approveKnowledgeItem(supabase, id, access.email || 'admin')
      : await rejectKnowledgeItem(supabase, id)

  if (result.ok) clearKnowledgeCache()

  const status = result.ok ? 200 : result.error === 'not_found' ? 404 : 400
  return NextResponse.json(result, { status })
}
