/**
 * POST /api/social/media/generate
 * Sosyal Medya composer'ı için AI ile görsel/video üretir ve social-media bucket'a
 * kaydeder. Hibrit erişim: modül abonelik ister + üretim kredi (design_generation)
 * tüketir. Üretim başarısız olursa kredi iade edilir.
 */
import { NextRequest, NextResponse } from 'next/server'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { COST_PER_GENERATION } from '@/lib/subscription/types'
import { generateAndStoreMedia, type AiMediaKind } from '@/lib/social/aiMedia'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // video üretimi uzun sürebilir

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any))
  const kind: AiMediaKind = body?.kind === 'video' ? 'video' : 'image'
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : undefined

  if (!prompt) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'Görsel açıklaması gerekli' }, { status: 400 })
  }

  // Abonelik + kredi (hibrit). Geçersiz istekte kredi düşmesin diye doğrulama önce.
  const access = await chargeFeature({
    featureKey: 'design_generation',
    creditCost: COST_PER_GENERATION,
    requireSubscription: true,
  })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  try {
    const media = await generateAndStoreMedia(access.user.id, { kind, prompt, aspectRatio })
    return NextResponse.json({ ok: true, data: media })
  } catch (err: any) {
    await access.refund() // üretim/yükleme hatası → krediyi geri ver
    console.error('[social.media.generate]', err?.message)
    return NextResponse.json({ ok: false, error: 'generation_failed', message: 'Üretim başarısız oldu' }, { status: 500 })
  }
}
