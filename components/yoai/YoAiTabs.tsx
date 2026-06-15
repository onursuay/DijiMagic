'use client'

/* ──────────────────────────────────────────────────────────
   YoAi alan sekmeleri — Komuta Merkezi ↔ Erken Uyarı.

   yoalgoritma layout'unda children üstünde ince sticky bar olarak render
   edilir. Erken Uyarı sekmesinde aktif (acil+yüksek) uyarı sayısı rozeti.
   ────────────────────────────────────────────────────────── */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Sparkles, ShieldAlert } from 'lucide-react'

const TABS = [
  { href: '/yoalgoritma', label: 'Komuta Merkezi', icon: Sparkles },
  { href: '/yoalgoritma/erken-uyari', label: 'Erken Uyarı', icon: ShieldAlert },
] as const

export default function YoAiTabs() {
  const pathname = usePathname()
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    let alive = true
    fetch('/api/yoai/watchdog', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.counts) setAlertCount((j.counts.critical || 0) + (j.counts.high || 0)) })
      .catch(() => {})
    return () => { alive = false }
  }, [pathname])

  return (
    <nav className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-1">
        {TABS.map((t) => {
          const active = t.href === '/yoalgoritma' ? pathname === '/yoalgoritma' : pathname.startsWith(t.href)
          const Icon = t.icon
          const showBadge = t.href === '/yoalgoritma/erken-uyari' && alertCount > 0
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative inline-flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                active ? 'border-primary text-primary' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {showBadge && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-semibold">
                  {alertCount}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
