'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { X, Search } from 'lucide-react'
import type { LookalikeState } from '../types'

interface StepCountryProps {
  state: LookalikeState
  onChange: (updates: Partial<LookalikeState>) => void
}

const POPULAR_COUNTRY_CODES = [
  'TR', 'US', 'DE', 'GB', 'FR', 'NL', 'IT', 'ES', 'SA', 'AE',
  'CA', 'AU', 'BR', 'JP', 'KR', 'IN', 'MX', 'PL', 'SE', 'NO',
  'AT', 'BE', 'CH', 'DK', 'GR', 'PT', 'RO', 'BG', 'AZ', 'GE',
]

export default function StepCountry({ state, onChange }: StepCountryProps) {
  const t = useTranslations('dashboard.hedefKitle.wizard.lookalike.country')
  const [search, setSearch] = useState('')

  const countries = POPULAR_COUNTRY_CODES.map((code) => ({ code, name: t(`names.${code}`) }))

  const filtered = countries.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (code: string) => {
    const next = state.countries.includes(code)
      ? state.countries.filter((c) => c !== code)
      : [...state.countries, code]
    onChange({ countries: next })
  }

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">{t('title')}</h3>
      <p className="text-sm text-gray-500 mb-6">
        {t('description')}
      </p>

      {/* Seçilen ülkeler */}
      {state.countries.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {state.countries.map((code) => {
            const country = countries.find((c) => c.code === code)
            return (
              <span key={code} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
                {country?.name ?? code}
                <button
                  type="button"
                  onClick={() => toggle(code)}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Arama */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {/* Liste */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
        {filtered.map((c) => {
          const selected = state.countries.includes(c.code)
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => toggle(c.code)}
              className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                selected
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              {c.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
