'use client'

import { useEffect, useState } from 'react'

function getLocale(): string {
  if (typeof document === 'undefined') return 'tr'
  return document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || 'tr'
}

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const [locale, setLocale] = useState('tr')
  useEffect(() => { setLocale(getLocale()) }, [])
  useEffect(() => { console.error(error) }, [error])
  const isEn = locale === 'en'
  const t = isEn
    ? { title: 'Critical error', desc: 'An application-wide error occurred. Please refresh the page.', refresh: 'Refresh' }
    : { title: 'Kritik hata', desc: 'Uygulama genelinde bir hata oluştu. Sayfayı yenileyin.', refresh: 'Yenile' }

  return (
    <html lang={isEn ? 'en' : 'tr'}>
      <body style={{ margin: 0, minHeight: '100vh', background: '#161d28', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', textAlign: 'center', padding: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>{t.title}</h2>
        <p style={{ color: '#9ca3af', maxWidth: 420, lineHeight: 1.6, margin: '0 0 28px' }}>{t.desc}</p>
        <button onClick={() => window.location.reload()} style={{ background: 'linear-gradient(90deg,#10b981,#14b8a6)', color: '#06251b', fontWeight: 600, fontSize: 15, padding: '12px 24px', borderRadius: 999, border: 'none', cursor: 'pointer' }}>
          {t.refresh}
        </button>
      </body>
    </html>
  )
}
