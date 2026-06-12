'use client'

import { useTranslations } from 'next-intl'
import type { SavedAudienceState } from '../types'
import CustomSelect from '@/components/ui/CustomSelect'

interface StepDemographyProps {
  state: SavedAudienceState
  onChange: (updates: Partial<SavedAudienceState>) => void
}

const GENDER_OPTIONS: { value: number[]; key: 'all' | 'male' | 'female' }[] = [
  { value: [] as number[], key: 'all' },
  { value: [1], key: 'male' },
  { value: [2], key: 'female' },
]

export default function StepDemography({ state, onChange }: StepDemographyProps) {
  const t = useTranslations('dashboard.hedefKitle.wizard.saved.demography')
  const gendersKey = state.genders.length === 0
    ? 'all'
    : state.genders.includes(1) && !state.genders.includes(2)
    ? 'male'
    : 'female'

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">{t('title')}</h3>
      <p className="text-sm text-gray-500 mb-6">{t('description')}</p>

      <div className="space-y-6">
        {/* Yaş aralığı */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t('ageRangeLabel')} <span className="text-primary font-semibold">{state.ageMin} – {state.ageMax}</span>
          </label>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-caption text-gray-500 mb-1">{t('min')}</label>
              <CustomSelect
                ariaLabel={t('minAgeAria')}
                value={Math.max(18, state.ageMin)}
                options={Array.from({ length: 48 }, (_, i) => i + 18).map((age) => ({ value: age, label: String(age) }))}
                onChange={(val) => {
                  const v = Math.max(18, Number(val))
                  onChange({ ageMin: v, ageMax: Math.max(v, state.ageMax) })
                }}
              />
            </div>
            <span className="text-gray-400 pt-5">—</span>
            <div className="flex-1">
              <label className="block text-caption text-gray-500 mb-1">{t('max')}</label>
              <CustomSelect
                ariaLabel={t('maxAgeAria')}
                value={Math.max(18, state.ageMax)}
                options={Array.from({ length: 48 }, (_, i) => i + 18).map((age) => ({ value: age, label: age === 65 ? '65+' : String(age) }))}
                onChange={(val) => {
                  const v = Math.max(18, Number(val))
                  onChange({ ageMax: v, ageMin: Math.min(state.ageMin, v) })
                }}
              />
            </div>
          </div>
        </div>

        {/* Cinsiyet */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">{t('gender')}</label>
          <div className="flex gap-3">
            {GENDER_OPTIONS.map(({ value, key }) => {
              const isSelected = gendersKey === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ genders: value })}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {t(`genderOption.${key}`)}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
