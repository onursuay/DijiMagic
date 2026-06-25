'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { mapPathToLocale } from '@/lib/routes'
import { Globe, ChevronDown } from 'lucide-react'

/**
 * Landing footer dil seçici — referans tasarımı (dark dropdown + bayraklar)
 * DijiMagic'in gerçek i18n mekanizmasıyla: NEXT_LOCALE cookie + mapPathToLocale.
 */
export default function FooterLangSwitcher() {
  const [currentLocale, setCurrentLocale] = useState('tr')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const locale = document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] || 'tr'
    setCurrentLocale(locale)
  }, [])

  // Dışarı tıklanınca kapan
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const changeLanguage = (targetLocale: string) => {
    document.cookie = `NEXT_LOCALE=${targetLocale}; path=/; max-age=31536000`
    const newPath = mapPathToLocale(pathname, targetLocale)
    window.location.assign(newPath)
  }

  const activeLabel = currentLocale === 'tr' ? 'Türkçe' : 'English'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-gray-500 transition-colors hover:bg-white/[0.08] hover:text-gray-300"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{activeLabel}</span>
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+8px)] right-0 z-[200] min-w-[140px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#1a1d21] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <button
            onClick={() => changeLanguage('tr')}
            className={`flex w-full items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-white/[0.05] ${currentLocale === 'tr' ? 'text-emerald-400' : 'text-gray-400 hover:text-white'}`}
          >
            <span className="text-base">🇹🇷</span> Türkçe
          </button>
          <button
            onClick={() => changeLanguage('en')}
            className={`flex w-full items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-white/[0.05] ${currentLocale === 'en' ? 'text-emerald-400' : 'text-gray-400 hover:text-white'}`}
          >
            <span className="text-base">🇬🇧</span> English
          </button>
        </div>
      )}
    </div>
  )
}
