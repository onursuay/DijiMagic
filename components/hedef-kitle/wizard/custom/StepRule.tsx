'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { CustomAudienceState, CustomAudienceRule, AudienceSource, IgEngagementType, PageEngagementType } from '../types'
import CustomSelect from '@/components/ui/CustomSelect'

interface StepRuleProps {
  state: CustomAudienceState
  onChange: (updates: Partial<CustomAudienceState>) => void
  assets: {
    pixels: { id: string; name: string }[]
    instagramAccounts: { id: string; username: string }[]
    pages: { id: string; name: string }[]
  }
}

const IG_ENGAGEMENT_VALUES: IgEngagementType[] = [
  'ig_business_profile_all',
  'ig_business_profile_engaged',
  'ig_user_messaged',
  'ig_user_saved',
  'ig_user_call_to_action',
  'ig_user_shared',
]

const PAGE_ENGAGEMENT_VALUES: PageEngagementType[] = [
  'page_engaged',
  'page_visited',
  'page_messaged',
  'page_cta_clicked',
  'page_saved',
]

const PIXEL_RULE_VALUES = ['ALL_VISITORS', 'SPECIFIC_PAGES', 'EVENTS'] as const

const PIXEL_EVENT_OPTIONS = [
  'ViewContent', 'AddToCart', 'Purchase', 'Lead', 'CompleteRegistration',
  'InitiateCheckout', 'AddPaymentInfo', 'Search', 'Contact', 'Subscribe',
]

function updateRule(state: CustomAudienceState, patch: Partial<CustomAudienceRule>): Partial<CustomAudienceState> {
  return { rule: { ...state.rule, ...patch } }
}

function RetentionSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useTranslations('dashboard.hedefKitle.wizard.custom.rule')
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {t('retentionLabel')} <span className="text-primary font-semibold">{t('days', { count: value })}</span>
      </label>
      <input
        type="range"
        min={1}
        max={180}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-caption text-gray-400 mt-1">
        <span>{t('days', { count: 1 })}</span>
        <span>{t('days', { count: 180 })}</span>
      </div>
    </div>
  )
}

function PixelRuleForm({ state, onChange, assets }: StepRuleProps) {
  const t = useTranslations('dashboard.hedefKitle.wizard.custom.rule')
  return (
    <div className="space-y-5">
      {/* Pixel seçimi */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('pixel')}</label>
        <CustomSelect
          value={state.rule.pixelId ?? ''}
          placeholder={t('pixelPlaceholder')}
          options={assets.pixels.map((p) => ({ value: p.id, label: `${p.name} (${p.id})` }))}
          onChange={(val) => onChange(updateRule(state, { pixelId: String(val) }))}
        />
      </div>

      {/* Kural tipi */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('ruleType')}</label>
        <div className="space-y-2">
          {PIXEL_RULE_VALUES.map((value) => (
            <label key={value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="ruleType"
                checked={state.rule.ruleType === value}
                onChange={() => onChange(updateRule(state, { ruleType: value as CustomAudienceRule['ruleType'] }))}
                className="accent-primary"
              />
              <span className="text-sm">{t(`pixelRule.${value}`)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* URL kuralı (SPECIFIC_PAGES) */}
      {state.rule.ruleType === 'SPECIFIC_PAGES' && (
        <div className="flex gap-3">
          <CustomSelect
            className="w-44 shrink-0"
            value={state.rule.urlOperator ?? 'contains'}
            options={[{ value: 'contains', label: t('urlContains') }, { value: 'equals', label: t('urlEquals') }]}
            onChange={(val) => onChange(updateRule(state, { urlOperator: val as 'contains' | 'equals' }))}
          />
          <input
            type="text"
            value={state.rule.urlValue ?? ''}
            onChange={(e) => onChange(updateRule(state, { urlValue: e.target.value }))}
            placeholder={t('urlPlaceholder')}
            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {/* Event seçimi (EVENTS) */}
      {state.rule.ruleType === 'EVENTS' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('event')}</label>
          <CustomSelect
            value={state.rule.eventName ?? ''}
            placeholder={t('eventPlaceholder')}
            options={PIXEL_EVENT_OPTIONS.map((ev) => ({ value: ev, label: ev }))}
            onChange={(val) => onChange(updateRule(state, { eventName: String(val) }))}
          />
        </div>
      )}

      <RetentionSlider
        value={state.rule.retention}
        onChange={(v) => onChange(updateRule(state, { retention: v }))}
      />
    </div>
  )
}

function IgRuleForm({ state, onChange, assets }: StepRuleProps) {
  const t = useTranslations('dashboard.hedefKitle.wizard.custom.rule')
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('igAccount')}</label>
        <CustomSelect
          value={state.rule.igAccountId ?? ''}
          placeholder={t('accountPlaceholder')}
          options={assets.instagramAccounts.map((a) => ({ value: a.id, label: `@${a.username}` }))}
          onChange={(val) => onChange(updateRule(state, { igAccountId: String(val) }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('engagementType')}</label>
        <div className="space-y-2">
          {IG_ENGAGEMENT_VALUES.map((value) => (
            <label key={value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="igEngagementType"
                checked={state.rule.igEngagementType === value}
                onChange={() => onChange(updateRule(state, { igEngagementType: value }))}
                className="accent-primary"
              />
              <span className="text-sm">{t(`igEngagement.${value}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <RetentionSlider
        value={state.rule.retention}
        onChange={(v) => onChange(updateRule(state, { retention: v }))}
      />
    </div>
  )
}

function PageRuleForm({ state, onChange, assets }: StepRuleProps) {
  const t = useTranslations('dashboard.hedefKitle.wizard.custom.rule')
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('facebookPage')}</label>
        <CustomSelect
          value={state.rule.pageId ?? ''}
          placeholder={t('pagePlaceholder')}
          options={assets.pages.map((p) => ({ value: p.id, label: p.name }))}
          onChange={(val) => onChange(updateRule(state, { pageId: String(val) }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('engagementType')}</label>
        <div className="space-y-2">
          {PAGE_ENGAGEMENT_VALUES.map((value) => (
            <label key={value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="pageEngagementType"
                checked={state.rule.pageEngagementType === value}
                onChange={() => onChange(updateRule(state, { pageEngagementType: value }))}
                className="accent-primary"
              />
              <span className="text-sm">{t(`pageEngagement.${value}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <RetentionSlider
        value={state.rule.retention}
        onChange={(v) => onChange(updateRule(state, { retention: v }))}
      />
    </div>
  )
}

function VideoRuleForm({ state, onChange }: { state: CustomAudienceState; onChange: StepRuleProps['onChange'] }) {
  const t = useTranslations('dashboard.hedefKitle.wizard.custom.rule')
  const videoRetentionValues = [
    'video_watched_3s',
    'video_watched_10s',
    'video_watched_25p',
    'video_watched_50p',
    'video_watched_75p',
    'video_watched_95p',
  ] as const

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('watchType')}</label>
        <div className="space-y-2">
          {videoRetentionValues.map((value) => (
            <label key={value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="videoRetentionType"
                checked={state.rule.videoRetentionType === value}
                onChange={() => onChange(updateRule(state, { videoRetentionType: value as CustomAudienceRule['videoRetentionType'] }))}
                className="accent-primary"
              />
              <span className="text-sm">{t(`videoRetention.${value}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <RetentionSlider
        value={state.rule.retention}
        onChange={(v) => onChange(updateRule(state, { retention: v }))}
      />
    </div>
  )
}

function GenericSourceForm({ source }: { state: CustomAudienceState; onChange: StepRuleProps['onChange']; source: AudienceSource }) {
  const t = useTranslations('dashboard.hedefKitle.wizard.custom.rule')
  const sourceLabel = ['LEADFORM', 'CATALOG', 'APP', 'OFFLINE', 'CUSTOMER_LIST'].includes(source)
    ? t(`genericSourceLabel.${source}`)
    : source

  return (
    <div className="space-y-5">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700">{t('unsupportedTitle', { source: sourceLabel })}</p>
        <p className="text-sm text-gray-500 mt-1">
          {t('unsupportedDesc')}
        </p>
      </div>
    </div>
  )
}

export default function StepRule({ state, onChange, assets }: StepRuleProps) {
  const t = useTranslations('dashboard.hedefKitle.wizard.custom.rule')
  const source = state.source

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">{t('title')}</h3>
      <p className="text-sm text-gray-500 mb-6">
        {t('description')}
      </p>

      {source === 'PIXEL' && <PixelRuleForm state={state} onChange={onChange} assets={assets} />}
      {source === 'IG' && <IgRuleForm state={state} onChange={onChange} assets={assets} />}
      {source === 'PAGE' && <PageRuleForm state={state} onChange={onChange} assets={assets} />}
      {source === 'VIDEO' && <VideoRuleForm state={state} onChange={onChange} />}
      {(source === 'LEADFORM' || source === 'CATALOG' || source === 'APP' || source === 'OFFLINE' || source === 'CUSTOMER_LIST') && (
        <GenericSourceForm state={state} onChange={onChange} source={source} />
      )}
      {!source && (
        <div className="text-center text-gray-400 py-8">
          {t('selectSourceFirst')}
        </div>
      )}
    </div>
  )
}
