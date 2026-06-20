import { NextResponse } from 'next/server'
import { metaGraphFetch } from '@/lib/metaGraph'
import { resolveMetaContext, checkAdAccountMismatch } from '@/lib/meta/context'
import { metaFetchWithRateLimit, isRateLimitError, extractFbTraceId } from '@/lib/meta/rateLimit'
import { getCacheKey, getCached, setCached } from '@/lib/meta/cache'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

type PerfRecItem = {
  id: string
  title: string
  message: string
  type: string
  entityId: string | number | null
  entityType: string
  impact: string | null
  defaultAction: unknown
  createdTime: string | null
  status: string
}

export async function GET(request: Request) {
  try {
    // GÜVENLİK (IDOR): cookie token (stale olabilir) + keyfi adAccountId, başka
    // hesabın performans önerilerinin okunmasına yol açıyordu. DB-izolasyonlu
    // bağlamı kullan — token ve hesap MEVCUT kullanıcının DB kaydından gelir.
    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json({
        ok: false,
        error: 'missing_token',
        message: 'Access token is missing',
      }, { status: 200 }) // Return 200 with ok:false instead of 401
    }

    // Query param adAccountId geldiyse bağlamla eşleşmeli (cross-account engellenir)
    const { searchParams } = new URL(request.url)
    const adAccountIdParam = searchParams.get('adAccountId')
    const mm = checkAdAccountMismatch(ctx, adAccountIdParam)
    if (mm?.mismatch) {
      return NextResponse.json({
        ok: false,
        error: 'ad_account_mismatch',
        message: 'Requested adAccountId does not match the authenticated account',
        resolved: mm.resolved,
        received: mm.received,
      }, { status: 200 })
    }

    // Tek doğruluk kaynağı: bağlamdaki normalize edilmiş hesap (act_XXX)
    const accountId = ctx.accountId

    // Check cache first
    const cacheKey = getCacheKey('meta', accountId, 'default', 'performance_recommendations')
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({ ok: true, ...cached })
    }

    // Fetch with rate-limit aware retry
    let response: Response
    let errorDataParsed: any = null
    
    try {
      const result = await metaFetchWithRateLimit(
        () => metaGraphFetch(
          `/${accountId}/performance_recommendations`,
          ctx.userAccessToken,
          {
            params: {
              fields: 'id,recommendation_type,recommendation_title,recommendation_message,level,entity_id,entity_type,impact,default_action,created_time,status',
              limit: '200',
            },
          }
        ),
        3
      )
      
      response = result.response
      errorDataParsed = result.errorData || null
    } catch (fetchError) {
      return NextResponse.json({
        ok: false,
        error: 'meta_api_error',
        message: 'Failed to fetch performance recommendations',
        details: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        code: undefined,
        subcode: undefined,
        fbtrace_id: undefined,
      }, { status: 200 })
    }

    // Handle non-OK response
    if (!response.ok) {
      // Use errorData from metaFetchWithRateLimit (already parsed)
      const errorData = errorDataParsed || { error: { message: `HTTP ${response.status}` } }
      const fbtraceId = extractFbTraceId(errorData)
      const isRateLimit = isRateLimitError(errorData)

      return NextResponse.json({
        ok: false,
        error: isRateLimit ? 'rate_limit_exceeded' : 'meta_api_error',
        message: isRateLimit
          ? 'Meta rate limit reached. Please wait and retry.'
          : 'Failed to fetch performance recommendations',
        details: errorData?.error || errorData,
        code: errorData?.error?.code,
        subcode: errorData?.error?.error_subcode,
        fbtrace_id: fbtraceId,
      }, { status: 200 }) // Always return 200 with ok:false
    }

    // Parse successful response
    let data: any = {}
    try {
      const text = await response.text()
      if (text) {
        data = JSON.parse(text)
      }
    } catch (parseError) {
      return NextResponse.json({
        ok: false,
        error: 'meta_api_error',
        message: 'Failed to parse Meta API response',
        details: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        code: undefined,
        subcode: undefined,
        fbtrace_id: undefined,
      }, { status: 200 })
    }

    const rawItems = data?.data || []

    // Defensive normalization
    const items: PerfRecItem[] = (Array.isArray(rawItems) ? rawItems : []).map((item: any) => ({
      id: item.id || '',
      title: item.recommendation_title || item.title || item.name || '',
      message: item.recommendation_message || item.message || item.description || '',
      type: item.recommendation_type || item.type || '',
      entityId: item.entity_id || item.object_id || null,
      entityType: item.entity_type || item.level || 'ACCOUNT',
      impact: item.impact || null,
      defaultAction: item.default_action || null,
      createdTime: item.created_time || null,
      status: item.status || 'ACTIVE',
    }))

    // Generate summary
    const byCampaignId: Record<string, number> = {}
    items.forEach((item: PerfRecItem) => {
      if (item.entityType === 'CAMPAIGN' && item.entityId) {
        const campaignId = String(item.entityId)
        byCampaignId[campaignId] = (byCampaignId[campaignId] || 0) + 1
      }
    })

    const result = {
      ok: true,
      items,
      summary: {
        total: items.length,
        byCampaignId,
      },
    }

    // Cache result
    setCached(cacheKey, result)

    return NextResponse.json(result)
  } catch (error) {
    if (DEBUG) console.error('Performance recommendations fetch error:', error)
      return NextResponse.json({
        ok: false,
        error: 'meta_api_error',
        message: 'An unexpected error occurred while fetching performance recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
        code: undefined,
        subcode: undefined,
        fbtrace_id: undefined,
      }, { status: 200 }) // Always return 200 with ok:false, never 502
  }
}
