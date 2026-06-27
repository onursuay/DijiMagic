'use client'

import { useEffect, useState } from 'react'

function getLocale(): string {
  if (typeof document === 'undefined') return 'tr'
  return document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || 'tr'
}

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [locale, setLocale] = useState('tr')
  useEffect(() => { setLocale(getLocale()) }, [])
  useEffect(() => { console.error(error) }, [error])
  const isEn = locale === 'en'
  const t = isEn
    ? { title: 'Something went wrong', desc: 'An unexpected problem occurred while loading the page. Please try again.', retry: 'Try again' }
    : { title: 'Bir hata oluştu', desc: 'Sayfa yüklenirken beklenmeyen bir problem oluştu. Tekrar deneyin.', retry: 'Tekrar dene' }

  return (
    <div className="min-h-screen bg-[#161d28] text-white flex flex-col items-center justify-center px-6 text-center">
      <h2 className="text-2xl font-bold mb-2">{t.title}</h2>
      <p className="text-gray-400 mb-7 max-w-md leading-relaxed">{t.desc}</p>
      <button onClick={() => reset()} className="inline-flex items-center gap-2 text-[15px] font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-black px-6 py-3 rounded-full hover:from-emerald-400 hover:to-teal-400 transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
        {t.retry}
      </button>
    </div>
  )
}
