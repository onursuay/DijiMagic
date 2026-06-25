import GooglePage from '@/app/dashboard/reklam/google/GooglePage'
import BusinessProfileGuard from '@/components/dijimagic/BusinessProfileGuard'

export default function GoogleAdsRoute() {
  return (
    <BusinessProfileGuard area="Google Reklamları">
      <GooglePage />
    </BusinessProfileGuard>
  )
}
