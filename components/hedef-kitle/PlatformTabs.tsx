'use client'

import Image from 'next/image'

export type Platform = 'meta' | 'google'

interface PlatformTabsProps {
  activePlatform: Platform
  onPlatformChange: (platform: Platform) => void
}

export default function PlatformTabs({ activePlatform, onPlatformChange }: PlatformTabsProps) {
  const platforms = [
    { id: 'meta' as const, label: 'Meta', icon: '/platform-icons/meta.svg' },
    { id: 'google' as const, label: 'Google', icon: '/platform-icons/google-ads.svg' },
  ]

  return (
    <div className="flex items-center justify-center gap-3">
      {platforms.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPlatformChange(p.id)}
          className={`flex items-center gap-2 px-8 py-2.5 rounded-lg text-sm font-medium transition-all border-2 ${
            activePlatform === p.id
              ? 'bg-white border-primary text-gray-800 shadow-sm'
              : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Image src={p.icon} alt={p.label} width={20} height={20} />
          {p.label}
        </button>
      ))}
    </div>
  )
}
