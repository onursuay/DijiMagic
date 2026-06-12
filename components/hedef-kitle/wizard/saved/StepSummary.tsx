'use client'

import { useTranslations } from 'next-intl'
import type { SavedAudienceState } from '../types'

interface StepSummaryProps {
  state: SavedAudienceState
  onChange: (updates: Partial<SavedAudienceState>) => void
}

export default function StepSummary({ state, onChange }: StepSummaryProps) {
  const t = useTranslations('dashboard.hedefKitle.wizard.saved.summary')
  const genderLabel =
    state.genders.length === 0
      ? t('genderAll')
      : state.genders.includes(1) && !state.genders.includes(2)
      ? t('genderMale')
      : state.genders.includes(2) && !state.genders.includes(1)
      ? t('genderFemale')
      : t('genderAll')

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">{t('title')}</h3>
      <p className="text-sm text-gray-500 mb-6">{t('description')}</p>

      <div className="space-y-5">
        {/* Ad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('nameLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={state.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t('namePlaceholder')}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Açıklama */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('descriptionLabel')}</label>
          <textarea
            value={state.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={t('descriptionPlaceholder')}
            rows={2}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        {/* Özet kartı */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">{t('typeLabel')}</span>
            <span className="text-sm font-medium text-gray-900">{t('typeValue')}</span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">{t('locationLabel')}</span>
            <span className="text-sm font-medium text-gray-900">
              {state.locations.length > 0
                ? state.locations.map((l) => l.name).join(', ')
                : t('locationDefault')}
            </span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">{t('ageRangeLabel')}</span>
            <span className="text-sm font-medium text-gray-900">
              {state.ageMin} – {state.ageMax === 65 ? '65+' : state.ageMax}
            </span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">{t('genderLabel')}</span>
            <span className="text-sm font-medium text-gray-900">{genderLabel}</span>
          </div>
          {state.locales.length > 0 && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">{t('languagesLabel')}</span>
              <span className="text-sm font-medium text-gray-900">{t('languageCount', { count: state.locales.length })}</span>
            </div>
          )}
          {state.interests.length > 0 && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">{t('interestsLabel')}</span>
              <span className="text-sm font-medium text-gray-900">{t('interestCount', { count: state.interests.length })}</span>
            </div>
          )}
          {state.excludeInterests.length > 0 && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">{t('excludedLabel')}</span>
              <span className="text-sm font-medium text-red-600">{t('interestCount', { count: state.excludeInterests.length })}</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Advantage+</span>
            <span className={`text-sm font-medium ${state.advantageAudience ? 'text-green-600' : 'text-gray-500'}`}>
              {state.advantageAudience ? t('on') : t('off')}
            </span>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <p className="text-sm text-primary font-medium">{t('willCreateTitle')}</p>
          <p className="text-sm text-primary/80 mt-0.5">
            {t('willCreateDesc')}
          </p>
        </div>
      </div>
    </div>
  )
}
