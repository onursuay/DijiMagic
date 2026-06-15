/**
 * Erken Uyarı sayfası — /yoalgoritma/erken-uyari
 * yoalgoritma layout'unu (AccountApprovalGuard + BusinessProfileGuard + Sidebar)
 * miras alır. İçerik ErkenUyariClient'te.
 */
import ErkenUyariClient from '@/components/yoai/ErkenUyariClient'

export const dynamic = 'force-dynamic'

export default function ErkenUyariPage() {
  return <ErkenUyariClient />
}
