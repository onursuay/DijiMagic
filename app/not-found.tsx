'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

function getLocale(): string {
  if (typeof document === 'undefined') return 'tr'
  return document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || 'tr'
}

export default function NotFound() {
  const [locale, setLocale] = useState('tr')
  useEffect(() => { setLocale(getLocale()) }, [])
  const isEn = locale === 'en'
  const t = isEn
    ? { title: 'Page not found', desc: 'The page you’re looking for may have moved or been removed.', home: 'Back to home' }
    : { title: 'Sayfa bulunamadı', desc: 'Aradığınız sayfa taşınmış veya silinmiş olabilir.', home: 'Ana sayfaya dön' }

  return (
    <div className="min-h-screen bg-[#161d28] text-white flex flex-col items-center justify-center px-6 text-center">
      <p className="text-7xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent mb-3">404</p>
      <h2 className="text-2xl font-bold mb-2">{t.title}</h2>
      <p className="text-gray-400 mb-7 max-w-md leading-relaxed">{t.desc}</p>
      <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-black px-6 py-3 rounded-full hover:from-emerald-400 hover:to-teal-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
        {t.home}
      </Link>
    </div>
  )
}
