/**
 * GET /api/social/analytics?from&to[&projectId]
 * Verilen aralıktaki yayınlanan içeriklerin etkileşim özeti + en iyi yayın saati.
 */
import { NextRequest, NextResponse } from 'next/server'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { listPostsInRange } from '@/lib/social/store'
import { buildAnalytics } from '@/lib/social/insights'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: 'from ve to gerekli' }, { status: 400 })
  }
  const projectId = searchParams.get('projectId')

  const posts = await listPostsInRange(access.user.id, { from, to, projectId })
  const summary = await buildAnalytics(access.user.id, posts)
  return NextResponse.json({ ok: true, data: summary })
}
