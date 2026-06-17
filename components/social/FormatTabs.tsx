'use client'

import { useTranslations } from 'next-intl'
import { LayoutGrid, Clapperboard, CircleDashed } from 'lucide-react'
import type { SocialFormat } from '@/lib/social/types'

const TABS: { id: SocialFormat; Icon: typeof LayoutGrid }[] = [
  { id: 'feed', Icon: LayoutGrid },
  { id: 'reels', Icon: Clapperboard },
  { id: 'story', Icon: CircleDashed },
]

export default function FormatTabs({
  value,
  onChange,
}: {
  value: SocialFormat
  onChange: (v: SocialFormat) => void
}) {
  const t = useTranslations('dashboard.sosyalmedya.tabs')

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {TABS.map(({ id, Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.97] ${
              active
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
            aria-pressed={active}
          >
            <Icon className="h-4 w-4" />
            {t(id)}
          </button>
        )
      })}
    </div>
  )
}
