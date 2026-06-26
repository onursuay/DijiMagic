import type { Metadata } from 'next'
import AboutContent from '@/components/legal/AboutContent'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'About - DijiMagic',
  description: 'DijiMagic — the AI-powered all-in-one marketing platform. Our mission and business information.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://dijimagic.com/about' },
}

export default function AboutPage() {
  return <AboutContent locale="en" />
}
