import { redirect } from 'next/navigation'

// TikTok Ads lansmanda gizli — entegrasyon onayı sonrası açılacak.
// URL ile doğrudan erişen kullanıcı dashboard'a yönlendirilir.
export default function TikTokAdsRoute() {
  redirect('/dashboard')
}
