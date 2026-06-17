import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { CreditProvider } from '@/components/providers/CreditProvider'
import { SubscriptionProvider } from '@/components/providers/SubscriptionProvider'
import RouteTracker from '@/components/analytics/RouteTracker'
import AnalyticsScripts from '@/components/analytics/AnalyticsScripts'
import CookieConsent from '@/components/consent/CookieConsent'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'optional',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://yoai.yodijital.com'),
  title: 'YoAI Dashboard',
  description: 'Reklam ve pazarlama yönetim platformu',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'

  // Check if this request is for a public-site path (/s/<subdomain>).
  // Middleware sets x-pathname so we get the real pathname even after rewrites
  // (e.g. custom-domain requests are rewritten to /s/<sub> before reaching here).
  const h = await headers()
  const pathname = h.get('x-pathname') || ''
  const isPublicSite = pathname.startsWith('/s/')

  // Public-site path: minimal tree — no dashboard providers, no analytics, no i18n.
  if (isPublicSite) {
    return (
      <html lang={locale}>
        <body className={`${inter.variable} ${inter.className} text-body`}>
          {children}
        </body>
      </html>
    )
  }

  // Dashboard path: full provider chain (unchanged behavior).
  const messages = await getMessages({ locale })

  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${inter.className} text-body`}>
        <script dangerouslySetInnerHTML={{ __html: `try{var s=localStorage.getItem('sidebar_collapsed');var w=s==='true'?'72px':'260px';document.documentElement.style.setProperty('--sidebar-width',w)}catch(e){}` }} />
        <AnalyticsScripts />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <RouteTracker />
          <SubscriptionProvider>
            <CreditProvider>
              {children}
            </CreditProvider>
          </SubscriptionProvider>
          <CookieConsent />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
