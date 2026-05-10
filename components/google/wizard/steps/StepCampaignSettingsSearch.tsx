'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Shield, Settings, Info } from 'lucide-react'
import { useLocale } from 'next-intl'
import type { StepProps } from '../shared/WizardTypes'
import { inputCls, LANGUAGE_OPTIONS } from '../shared/WizardTypes'
import StepLocationLanguage from './StepLocationLanguage'
import StepAudience from './StepAudience'
import StepAdSchedule from './StepAdSchedule'
import { GoogleWizardRadioOption } from '../shared/GoogleWizardUI'

function CollapsibleSection({ title, defaultOpen = true, children }: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
      >
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'

export default function StepCampaignSettingsSearch({ state, update, t }: StepProps) {
  const [otherSettingsOpen, setOtherSettingsOpen] = useState(false)
  const isSearch = state.campaignType === 'SEARCH'
  const locale = useLocale()
  const euPolicyUrl = `${EU_POLICY_URL}?hl=${locale === 'tr' ? 'tr' : 'en'}`

  return (
    <div className="space-y-6">
      {/* 1. Network Settings — only for SEARCH */}
      {isSearch && (
        <section>
          <h4 className="text-[15px] font-semibold text-gray-900 mb-1">{t('settings.networksTitle')}</h4>
          <p className="text-[13px] text-gray-500 mb-3">{t('settings.networksGoogleSearchAlwaysOn')}</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={state.networkSettings.targetSearchNetwork}
                onChange={e => update({ networkSettings: { ...state.networkSettings, targetSearchNetwork: e.target.checked } })}
                className="rounded border-gray-300 text-primary focus:ring-primary/20"
              />
              <span className="text-gray-700">{t('settings.networksSearchPartners')}</span>
              <span className="text-xs text-gray-400">({t('settings.networksSearchPartnersHint')})</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={state.networkSettings.targetContentNetwork}
                onChange={e => update({ networkSettings: { ...state.networkSettings, targetContentNetwork: e.target.checked } })}
                className="rounded border-gray-300 text-primary focus:ring-primary/20"
              />
              <span className="text-gray-700">{t('settings.networksDisplay')}</span>
              <span className="text-xs text-gray-400">({t('settings.networksDisplayHint')})</span>
            </label>
          </div>
        </section>
      )}

      {/* 2. Locations */}
      <CollapsibleSection title={t('settings.locationsTitle')}>
        <StepLocationLanguage state={state} update={update} t={t} />
      </CollapsibleSection>

      {/* 3. Languages */}
      <CollapsibleSection title={t('settings.languagesTitle')}>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-2">{t('settings.languagesLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map(lang => {
              const selected = state.languageIds.includes(lang.id)
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => {
                    const has = state.languageIds.includes(lang.id)
                    update({ languageIds: has ? state.languageIds.filter(id => id !== lang.id) : [...state.languageIds, lang.id] })
                  }}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {lang.name}
                  {selected && <span className="text-primary ml-1">×</span>}
                </button>
              )
            })}
          </div>
          {state.languageIds.length === 0 && (
            <p className="text-xs text-red-500">{t('validation.languageRequired')}</p>
          )}
        </div>
      </CollapsibleSection>

      {/* 4. EU Political Ads — Display tasarım standardında radio card */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-3 mb-5">
          <span className="mt-0.5 text-gray-400"><Shield className="w-[18px] h-[18px]" /></span>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-gray-900">{t('settings.euPoliticalTitle')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t('settings.euPoliticalQuestion')}</p>
          </div>
        </div>
        <div className="space-y-2">
          <GoogleWizardRadioOption
            name="euPoliticalAdsDeclaration"
            value="NOT_POLITICAL"
            checked={state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'}
            onChange={() => update({ euPoliticalAdsDeclaration: 'NOT_POLITICAL' })}
            title={t('settings.euPoliticalNotPolitical')}
            description={state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'
              ? `${t('settings.euPoliticalHelperNote')} ${t('settings.euPoliticalHelperNoteOptional')}`
              : undefined}
          />
          <GoogleWizardRadioOption
            name="euPoliticalAdsDeclaration"
            value="POLITICAL"
            checked={state.euPoliticalAdsDeclaration === 'POLITICAL'}
            onChange={() => update({ euPoliticalAdsDeclaration: 'POLITICAL' })}
            title={t('settings.euPoliticalPolitical')}
          />
          {state.euPoliticalAdsDeclaration === 'POLITICAL' && (
            <div className="flex items-start gap-2 p-3.5 mt-2 rounded-xl border border-primary/20 bg-primary/5 text-[13px] text-primary">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t('settings.euPoliticalWarningLine1')}</p>
                <p className="mt-1">{t('settings.euPoliticalWarningLine2')}</p>
                <a
                  href={euPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block underline hover:opacity-80"
                >
                  {t('settings.euPoliticalWarningLearnMore')}
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 5. Audience — embedded protected component, unchanged */}
      <section>
        <h4 className="text-[15px] font-semibold text-gray-900 mb-3">{t('steps.audience')}</h4>
        <StepAudience state={state} update={update} t={t} />
      </section>

      {/* 6. Ad Schedule */}
      <section>
        <StepAdSchedule state={state} update={update} t={t} />
      </section>

      {/* 7. Other settings accordion */}
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setOtherSettingsOpen(!otherSettingsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-600" />
            <span className="text-[15px] font-semibold text-gray-900">{t('settings.otherSettingsTitle')}</span>
          </div>
          {otherSettingsOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {otherSettingsOpen && (
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('campaign.startDate')}>
                <input className={inputCls} type="date" value={state.startDate} onChange={e => update({ startDate: e.target.value })} />
              </Field>
              <Field label={t('campaign.endDate')}>
                <input className={inputCls} type="date" value={state.endDate} onChange={e => update({ endDate: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
