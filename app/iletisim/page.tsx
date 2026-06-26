import type { Metadata } from 'next'
import ContactContent from '@/components/legal/ContactContent'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'İletişim - DijiMagic',
  description: 'DijiMagic ile iletişime geçin. E-posta, işletme ve adres bilgileri.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://dijimagic.com/iletisim' },
}

export default function IletisimPage() {
  return <ContactContent locale="tr" />
}
