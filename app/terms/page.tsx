import type { Metadata } from 'next'
import TermsContent from '@/components/legal/TermsContent'

export const metadata: Metadata = {
  title: 'Terms of Service - DijiMagic',
  description: 'DijiMagic Terms of Service.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://dijimagic.com/en/terms-of-service' },
}

export default function TermsPage() {
  return <TermsContent locale="en" />
}
