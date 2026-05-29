import { NextResponse } from 'next/server'
import { isMarketingSetupVisible } from '@/lib/marketing-setup/visibility'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Sidebar visibility gate for the Marketing Setup wizard.
 * Always returns 200 with { visible: boolean } — never leaks why it is hidden.
 * Non-owners with the flag off get { visible: false }.
 */
export async function GET() {
  const visible = await isMarketingSetupVisible().catch(() => false)
  return NextResponse.json({ visible })
}
