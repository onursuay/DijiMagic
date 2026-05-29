import 'server-only'
import { getIsCurrentUserSuperAdmin } from '@/lib/admin/superAdmin'
import { isMarketingSetupFlagEnabled } from './constants'

/**
 * The Marketing Setup wizard is hidden during rollout: visible only to owners
 * (super-admin allowlist) unless MARKETING_SETUP_ENABLED is turned on.
 * This is the single gate used by both the sidebar visibility endpoint and the
 * page-level server guard.
 */
export async function isMarketingSetupVisible(): Promise<boolean> {
  if (isMarketingSetupFlagEnabled()) return true
  return getIsCurrentUserSuperAdmin()
}
