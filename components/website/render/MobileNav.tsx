'use client'

import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

interface NavItem { label: string; href: string }

/**
 * Üretilen sitenin mobil menüsü (client island). HeaderSection saf-sunum olduğu için
 * hamburger + açılır panel buraya taşınır. Masaüstünde gizli (md:hidden), mobilde görünür.
 */
export default function MobileNav({
  items,
  ctaLabel,
  ctaHref,
  menuLabel,
  closeLabel,
}: {
  items: NavItem[]
  ctaLabel?: string
  ctaHref?: string
  menuLabel: string
  closeLabel: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label={menuLabel}
        className="-mr-2 p-2 transition-transform active:scale-90"
        style={{ color: 'var(--site-ink)' }}
      >
        <Menu className="w-6 h-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col">
          <div className="h-[74px] px-6 flex items-center justify-end border-b border-black/[0.06]">
            <button onClick={() => setOpen(false)} aria-label={closeLabel} className="-mr-2 p-2" style={{ color: 'var(--site-ink)' }}>
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex flex-col px-6 pt-2">
            {items.map((l, i) => (
              <a
                key={i}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-4 text-[1.15rem] font-medium border-b border-black/[0.06]"
                style={{ color: 'var(--site-ink)' }}
              >
                {l.label}
              </a>
            ))}
            {ctaLabel && (
              <a
                href={ctaHref}
                onClick={() => setOpen(false)}
                className="mt-7 inline-flex items-center justify-center rounded-full px-7 py-3.5 text-[1rem] font-medium"
                style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}
              >
                {ctaLabel}
              </a>
            )}
          </nav>
        </div>
      )}
    </div>
  )
}
