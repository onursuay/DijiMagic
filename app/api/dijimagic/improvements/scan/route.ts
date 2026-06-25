import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { isAiEngineEnabled } from '@/lib/dijimagic/featureFlag'
import { isAnthropicReady } from '@/lib/anthropic/client'
import { isInngestReady, inngest } from '@/inngest/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/**
 * POST /api/dijimagic/improvements/scan
 * On-demand "Şimdi Tara" — tek kullanıcı için kart üretimi tetikler.
 *
 * R7: ARTIK hiyerarşik akışı (campaign-improvements.user) fırlatır. Eski per-ad
 * akışı (dijialgoritma/improvements.user → ai_ad_improvements) kapatıldı: hiçbir yol
 * onu tetiklemiyor (function rollback için kayıtlı kalır, [perAdImprovements.ts]).
 * Aksi halde bu uç eski paralel kartları üretip kullanıcıyı/maliyeti şişirirdi.
 */
export async function POST() {
  if (!isAiEngineEnabled()) {
    return NextResponse.json({ ok: false, error: 'AI motoru kapalı' }, { status: 503 })
  }
  if (!isAnthropicReady()) {
    return NextResponse.json({ ok: false, error: 'AI servisi yapılandırılmamış' }, { status: 503 })
  }
  if (!isInngestReady()) {
    return NextResponse.json({ ok: false, error: 'Tarama altyapısı yapılandırılmamış' }, { status: 503 })
  }

  const cookieStore = await cookies()
  const userId = readUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

  await inngest.send({ name: 'dijialgoritma/campaign-improvements.user', data: { userId } })
  return NextResponse.json({ ok: true, message: 'Tarama başlatıldı. Kartlar hazır olunca burada görünecek.' })
}
