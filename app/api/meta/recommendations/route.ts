import { NextResponse } from 'next/server'
import { metaGraphFetchJSON } from '@/lib/metaGraph'
import { resolveMetaContext } from '@/lib/meta/context'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'
export const revalidate = 60

type FlatRec = {
  type: string
  object_ids: string[]
  title: string | null
  description: string | null
  points: number | null
  impact: string | null
  deep_link: string | null
}

function asArray<T>(v: any): T[] {
  return Array.isArray(v) ? v : (v ? [v] : [])
}

function normalizeLocale(input: string | null): string {
  if (!input) return 'tr_TR'
  // accept: tr, tr_TR, en, en_US
  if (input === 'tr') return 'tr_TR'
  if (input === 'en') return 'en_US'
  return input
}

function flattenRecommendations(payload: any): FlatRec[] {
  const root = payload || {}
  // sometimes payload.data, sometimes payload.recommendations, sometimes payload.data.recommendations
  const groups = asArray<any>(root.data ?? root.recommendations ?? root?.data?.recommendations ?? [])

  const flattened: any[] = []
  for (const g of groups) {
    // sometimes group = { recommendations: [...] }
    const inner = g?.recommendations
    if (Array.isArray(inner)) {
      // inner may contain items OR nested groups again
      for (const x of inner) {
        if (x?.recommendations && Array.isArray(x.recommendations)) {
          flattened.push(...x.recommendations)
        } else {
          flattened.push(x)
        }
      }
    } else {
      // group itself might be a recommendation item
      flattened.push(g)
    }
  }

  // final normalize to FlatRec
  return flattened.map((item: any) => {
    const content = item?.recommendation_content || {}
    const objectIds = item?.object_ids ?? item?.objectIds ?? []
    return {
      type: String(item?.type ?? 'UNKNOWN'),
      object_ids: Array.isArray(objectIds) ? objectIds.map(String) : [],
      title: content?.title ? String(content.title) : null,
      description: content?.body ? String(content.body) : null,
      points: content?.opportunity_score_lift != null ? Number(content.opportunity_score_lift) : null,
      impact: content?.lift_estimate ? String(content.lift_estimate) : null,
      deep_link: item?.url ? String(item.url) : null,
    } as FlatRec
  })
}

export async function GET(request: Request) {
  // GÜVENLİK (IDOR): cookie token (stale olabilir) yerine DB-izolasyonlu bağlamı
  // kullan — token ve hesap MEVCUT kullanıcının DB kaydından gelir.
  const ctx = await resolveMetaContext()
  if (!ctx) return NextResponse.json({ error: 'missing_token' }, { status: 401 })

  const url = new URL(request.url)
  const locale = normalizeLocale(url.searchParams.get('locale'))

  // Tek doğruluk kaynağı: bağlamdaki normalize edilmiş hesap (act_XXX)
  const accountId = ctx.accountId

  try {
    const recRes = await metaGraphFetchJSON(`/${accountId}/recommendations`, ctx.userAccessToken, {
      params: { locale },
    })
    if (recRes.error) {
      return NextResponse.json(recRes.error, { status: 502 })
    }
    const recPayload = recRes.data

    // opportunity score can come from separate endpoint OR sometimes from root
    let opportunityScore: number | null = null
    try {
      const osRes = await metaGraphFetchJSON(`/${accountId}/opportunity_score`, ctx.userAccessToken, { params: { locale } })
      if (!osRes.error) {
        const score = osRes.data?.opportunity_score?.score
        opportunityScore = score != null ? Number(score) : null
      }
    } catch {
      const maybeScore =
        recPayload?.opportunity_score?.score ??
        recPayload?.opportunity_score ??
        null

      opportunityScore = maybeScore != null ? Number(maybeScore) : null
    }

    const recommendations = flattenRecommendations(recPayload)

    // Dedupe: same type + same object_ids + same description
    const deduped = new Map<string, FlatRec>()
    for (const r of recommendations) {
      const key = `${r.type}::${(r.object_ids || []).join(',')}::${r.description || ''}`
      if (!deduped.has(key)) {
        deduped.set(key, r)
      }
    }
    const recommendationsUnique = Array.from(deduped.values())

    return NextResponse.json(
      { opportunity_score: opportunityScore, recommendations: recommendationsUnique },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    if (DEBUG) console.error('Recommendations fetch error:', error)
    return NextResponse.json({ error: 'meta_api_error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 502 })
  }
}
