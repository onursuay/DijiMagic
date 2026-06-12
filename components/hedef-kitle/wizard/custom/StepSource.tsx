'use client'

import { useTranslations } from 'next-intl'
import { Monitor, Instagram, FileText, Video, ClipboardList, Package, Smartphone, Wifi, Users } from 'lucide-react'
import type { AudienceSource, CustomAudienceState } from '../types'

interface StepSourceProps {
  state: CustomAudienceState
  onChange: (updates: Partial<CustomAudienceState>) => void
  assets: {
    pixels: { id: string; name: string }[]
    instagramAccounts: { id: string; username: string }[]
    pages: { id: string; name: string }[]
  }
}

const SOURCE_OPTIONS: { id: AudienceSource; icon: React.ComponentType<{ className?: string }>; disabled?: boolean }[] = [
  { id: 'PIXEL', icon: Monitor },
  { id: 'IG', icon: Instagram },
  { id: 'PAGE', icon: FileText },
  { id: 'VIDEO', icon: Video },
  { id: 'LEADFORM', icon: ClipboardList },
  { id: 'CATALOG', icon: Package },
  { id: 'APP', icon: Smartphone },
  { id: 'OFFLINE', icon: Wifi },
  { id: 'CUSTOMER_LIST', icon: Users },
]

const UNSUPPORTED_SOURCES: AudienceSource[] = ['CATALOG', 'APP', 'OFFLINE', 'CUSTOMER_LIST']

type ReasonKey = 'unsupported' | 'noPixel' | 'noIg' | 'noPage'

function isSourceAvailable(source: AudienceSource, assets: StepSourceProps['assets']): { available: boolean; reasonKey?: ReasonKey } {
  if (UNSUPPORTED_SOURCES.includes(source)) {
    return { available: false, reasonKey: 'unsupported' }
  }
  switch (source) {
    case 'PIXEL':
      return assets.pixels.length > 0
        ? { available: true }
        : { available: false, reasonKey: 'noPixel' }
    case 'IG':
      return assets.instagramAccounts.length > 0
        ? { available: true }
        : { available: false, reasonKey: 'noIg' }
    case 'PAGE':
      return assets.pages.length > 0
        ? { available: true }
        : { available: false, reasonKey: 'noPage' }
    default:
      return { available: true }
  }
}

export default function StepSource({ state, onChange, assets }: StepSourceProps) {
  const t = useTranslations('dashboard.hedefKitle.wizard.custom.source')
  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">{t('title')}</h3>
      <p className="text-sm text-gray-500 mb-6">{t('description')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SOURCE_OPTIONS.map(({ id, icon: Icon }) => {
          const { available, reasonKey } = isSourceAvailable(id, assets)
          const isSelected = state.source === id

          return (
            <button
              key={id}
              type="button"
              disabled={!available}
              onClick={() => onChange({ source: id, rule: { retention: 30 } })}
              className={`relative flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : available
                  ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isSelected ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                  {t(`sourceLabel.${id}`)}
                </p>
                {!available && reasonKey && (
                  <p className="text-caption text-red-500 mt-0.5">{t(`reason.${reasonKey}`)}</p>
                )}
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-white text-xs">{'\u2713'}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
