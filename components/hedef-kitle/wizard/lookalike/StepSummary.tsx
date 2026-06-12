'use client'

import { useTranslations } from 'next-intl'
import type { LookalikeState } from '../types'

interface StepSummaryProps {
  state: LookalikeState
  onChange: (updates: Partial<LookalikeState>) => void
}

export default function StepSummary({ state, onChange }: StepSummaryProps) {
  const t = useTranslations('dashboard.hedefKitle.wizard.lookalike.summary')
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
            <span className="text-sm text-gray-500">{t('seedLabel')}</span>
            <span className="text-sm font-medium text-gray-900">{state.seedName || '—'}</span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">{t('countriesLabel')}</span>
            <span className="text-sm font-medium text-gray-900">
              {state.countries.length > 0 ? state.countries.join(', ') : '—'}
            </span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">{t('sizeLabel')}</span>
            <span className="text-sm font-medium text-primary">%{state.sizePercent}</span>
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
