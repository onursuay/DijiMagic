/**
 * POST /api/strategy/instances/:id/expert-plan
 * Uzman Kampanya Planı (advisory) — aktif kanal(lar) için gerekçeli plan üretir.
 * Flag EXPERT_PLAN_ENABLED kapalıysa { disabled:true } döner (Strateji aynı kalır).
 * Publish'e dokunmaz; yalnız öneri.
 */
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import { getApprovedKnowledgeByPlatform } from '@/lib/yoai/officialAdsKnowledgeStore'
import { generateExpertPlan, type ExpertPlanContext, type PlatformKey } from '@/lib/strategy/expertPlan'
import type { InputPayload } from '@/lib/strategy/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function toEngineKnowledge(items: Awaited<ReturnType<typeof getApprovedKnowledgeByPlatform>>) {
  return items.map((k) => ({
    category: k.category,
    normalized_key: k.normalized_key,
    summary: k.summary,
    rules_json: k.rules_json,
    allowed_values: k.allowed_values,
  }))
}

function ctaAllowedFrom(items: Awaited<ReturnType<typeof getApprovedKnowledgeByPlatform>>): string[] {
  const out = new Set<string>()
  for (const k of items) {
    if (k.category === 'cta' && Array.isArray(k.allowed_values)) {
      for (const v of k.allowed_values) if (v) out.add(v)
    }
  }
  return Array.from(out)
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.EXPERT_PLAN_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, disabled: true })
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { id } = await params

  const { data: instance } = await supabase
    .from('strategy_instances')
    .select('id')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .eq('user_id', ctx.userId)
    .single()
  if (!instance) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { data: latestInput } = await supabase
    .from('strategy_inputs')
    .select('payload')
    .eq('strategy_instance_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const input = latestInput?.payload as InputPayload | undefined
  if (!input) {
    return NextResponse.json({ ok: false, error: 'no_input', message: 'Strateji girdisi bulunamadı' }, { status: 400 })
  }

  const platforms: PlatformKey[] = []
  if (input.channels?.meta) platforms.push('meta')
  if (input.channels?.google) platforms.push('google')
  if (platforms.length === 0) platforms.push('meta') // varsayılan

  try {
    const results = await Promise.all(
      platforms.map(async (platform) => {
        const knowledge = await getApprovedKnowledgeByPlatform(platform)
        const planCtx: ExpertPlanContext = {
          input,
          platform,
          approvedKnowledge: toEngineKnowledge(knowledge),
          ctaAllowed: ctaAllowedFrom(knowledge),
        }
        const plan = await generateExpertPlan(planCtx)
        return [platform, plan] as const
      }),
    )

    const plans: Record<string, unknown> = {}
    for (const [platform, plan] of results) plans[platform] = plan

    return NextResponse.json({ ok: true, plans, generatedAt: new Date().toISOString() })
  } catch (e) {
    console.error('[strategy/expert-plan] hata:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
