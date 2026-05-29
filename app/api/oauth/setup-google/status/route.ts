import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getSetupConsentStatus } from '@/lib/marketing-setup/setupGoogleToken'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ connected: false, scopes: [] })
  }
  const status = await getSetupConsentStatus(user.id)
  return NextResponse.json(status)
}
