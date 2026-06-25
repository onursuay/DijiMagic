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
  metadataBase: new URL('https://dijimagic.com'),
  title: 'DijiMagic Dashboard',
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
        {/* DEV-OVERLAY GÜRÜLTÜ BASTIRMA (parse-time, Next hata-overlay handler'ından ÖNCE
            kaydolmalı → bu yüzden inline script, useEffect DEĞİL). Next dev overlay'inin
            odak yardımcısı (ally.js) sayfadaki sandboxed önizleme iframe'inin (origin "null")
            document'ını okumaya çalışıp "Blocked a frame ... cross-origin" SecurityError'ı
            fırlatıyor → overlay önizlemenin üstüne açılıp Web Site Yöneticisi tıkla-seç
            düzenlemeyi engelliyordu. Bu, bizim KASITLI sandbox'ımıza dair yanlış-pozitif
            (kodumuz cross-origin frame'i hiç okumaz; seçim yalnız postMessage). Yalnız BU
            spesifik hata yutulur; başka hiçbir hata etkilenmez. Production'da dev overlay
            yok → no-op. capture + stopImmediatePropagation ile hem addEventListener hem
            window.onerror overlay'i bastırılır (mine-first olduğu için çalışır). */}
        <script dangerouslySetInnerHTML={{ __html: `try{window.addEventListener('error',function(e){var m=(e&&e.message)||'';if(/Blocked a frame with origin|cross-origin frame/i.test(m)){e.stopImmediatePropagation();if(e.preventDefault)e.preventDefault();}},true)}catch(_){}` }} />
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
