import type { Metadata } from 'next'
import AboutContent from '@/components/legal/AboutContent'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Hakkımızda - DijiMagic',
  description: 'DijiMagic — yapay zeka destekli hepsi bir arada pazarlama platformu. Misyonumuz ve işletme bilgilerimiz.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://dijimagic.com/hakkimizda' },
}

export default function HakkimizdaPage() {
  return <AboutContent locale="tr" />
}
