import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { approveImprovement } from '@/lib/yoai/ai/improvementStore'
import { improvementToProposal } from '@/lib/yoai/ai/improvementToProposal'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/**
 * POST /api/yoai/improvements/[id]/approve
 * Kartı "Onaylandı" yapar ve önizleme→yayınlama sihirbazı için
 * ad_spec'ten üretilmiş proposal'ı döner. Gerçek yayın MEVCUT
 * AdCreationWizard akışıyla (önizleme→yayınla) yapılır.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

    const row = await approveImprovement(userId, id)
    if (!row) {
      return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: 'Kart bulunamadı veya zaten karara bağlanmış.' }, { status: 404 })
    }
    const proposal = improvementToProposal(row)
    return NextResponse.json({ ok: true, data: { improvement: row, proposal } })
  } catch (e) {
    console.error('[improvements approve] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
