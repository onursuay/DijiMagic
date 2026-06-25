import type { Metadata } from 'next'
import PrivacyPolicyContent from '@/components/legal/PrivacyPolicyContent'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Gizlilik Politikası - DijiMagic',
  description: 'DijiMagic Gizlilik Politikası. Pazarlama platformumuzu kullanırken verilerinizi nasıl topladığımızı, kullandığımızı ve koruduğumuzu öğrenin.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://dijimagic.com/gizlilik-politikasi' },
}

export default function GizlilikPolitikasiPage() {
  return <PrivacyPolicyContent locale="tr" />
}
