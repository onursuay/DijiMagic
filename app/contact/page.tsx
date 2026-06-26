import type { Metadata } from 'next'
import ContactContent from '@/components/legal/ContactContent'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Contact - DijiMagic',
  description: 'Get in touch with DijiMagic. Email, business and address information.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://dijimagic.com/contact' },
}

export default function ContactPage() {
  return <ContactContent locale="en" />
}
