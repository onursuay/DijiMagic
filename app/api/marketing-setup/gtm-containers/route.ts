import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getSetupAccessToken } from '@/lib/marketing-setup/setupGoogleToken'
import { listContainers, type GtmContainerSummary } from '@/lib/marketing-setup/gtmClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/marketing-setup/gtm-containers
 * Auto-detect the user's existing GTM containers (web) via the setup-consent
 * token, so the wizard can offer them for selection instead of manual entry.
 * Always 200 with a containers array (possibly empty); never throws to the UI.
 */
export async function GET(): Promise<
  NextResponse<{ ok: boolean; containers: GtmContainerSummary[]; reason?: string }>
> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, containers: [], reason: 'unauthorized' }, { status: 401 })
  }

  const token = await getSetupAccessToken(user.id)
  if (!token) {
    return NextResponse.json({ ok: false, containers: [], reason: 'not_connected_setup' })
  }

  try {
    const containers = await listContainers(token)
    return NextResponse.json(
      { ok: true, containers },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json({ ok: false, containers: [], reason: 'list_failed' })
  }
}
