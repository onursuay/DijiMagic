'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, ShieldCheck, ExternalLink, Building2, BarChart3, Search } from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import GoogleCloudSetupModal from '@/components/marketing-setup/GoogleCloudSetupModal'
import type { StepProps } from '@/components/marketing-setup/wizardTypes'

export default function PlatformConnect({ state, update, goNext, goBack }: StepProps) {
  const t = useTranslations('marketingSetup')
  const [cloudOpen, setCloudOpen] = useState(false)

  const conn = state.connections
  const googleConnected = !!(conn?.googleAds.connected || conn?.ga4.connected || conn?.gsc.connected)
  const metaConnected = !!conn?.meta.connected
  const setupConnected = !!conn?.setupConsent.connected

  async function persist(patch: Record<string, unknown>) {
    try {
      await fetch('/api/marketing-setup/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch }),
      })
    } catch {
      /* best-effort; values remain in wizard state */
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{t('connect.title')}</h2>
        <p className="mt-1.5 text-sm text-gray-500">{t('connect.description')}</p>
      </div>

      {/* Connection cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google */}
        <div className="flex flex-col bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-1.5">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-gray-900">{t('connect.googleTitle')}</h3>
          </div>
          <p className="text-xs text-gray-500 flex-1">{t('connect.googleDescription')}</p>
          <div className="mt-4">
            {googleConnected ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                {t('common.connected')}
              </span>
            ) : (
              <div className="flex flex-wrap gap-2">
                <a
                  href="/api/integrations/google-ads/start"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
                >
                  {t('preview.googleAds')}
                </a>
                <a
                  href="/api/integrations/google-analytics/start"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
                >
                  {t('preview.ga4')}
                </a>
                <a
                  href="/api/integrations/google-search-console/start"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
                >
                  {t('preview.gsc')}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-col bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-gray-900">{t('connect.metaTitle')}</h3>
          </div>
          <p className="text-xs text-gray-500 flex-1">{t('connect.metaDescription')}</p>
          <div className="mt-4">
            {metaConnected ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                {t('common.connected')}
              </span>
            ) : (
              <a
                href="/api/meta/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium shadow-sm hover:bg-primary/90 transition-colors"
              >
                {t('connect.connectMeta')}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Setup permissions */}
      <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">{t('connect.setupConsentTitle')}</h3>
            <p className="mt-1 text-xs text-gray-500">{t('connect.setupConsentDescription')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {setupConnected ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('connect.setupConsentConnected')}
                </span>
              ) : (
                <a
                  href="/api/oauth/setup-google/start"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium shadow-sm hover:bg-primary/90 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {t('connect.setupConsentConnect')}
                </a>
              )}
              <button
                type="button"
                onClick={() => setCloudOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t('connect.cloudSetupGuide')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account / identifier inputs */}
      <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Meta ad account id */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('connect.metaAdAccountId')}
          </label>
          <input
            type="text"
            value={state.metaAdAccountId}
            onChange={(e) => update({ metaAdAccountId: e.target.value })}
            onBlur={(e) => persist({ meta_ad_account_id: e.target.value.trim() })}
            placeholder={t('connect.metaAdAccountIdPlaceholder')}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>

        {/* Google Ads customer id (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('connect.googleAdsCustomerId')}
            <span className="ml-2 text-xs font-normal text-gray-400">{t('common.optional')}</span>
          </label>
          <input
            type="text"
            value={state.googleAdsCustomerId}
            onChange={(e) => update({ googleAdsCustomerId: e.target.value })}
            onBlur={(e) => persist({ google_ads_customer_id: e.target.value.trim() })}
            placeholder={t('connect.googleAdsCustomerIdPlaceholder')}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>

        {/* GTM mode + container id */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('connect.gtmChoiceLabel')}
          </label>
          <WizardSelect
            value={state.gtmMode}
            onChange={(v) => update({ gtmMode: v === 'existing' ? 'existing' : 'create' })}
            options={[
              { value: 'create', label: t('connect.gtmCreate') },
              { value: 'existing', label: t('connect.gtmExisting') },
            ]}
          />
          {state.gtmMode === 'existing' && (
            <input
              type="text"
              value={state.gtmContainerId}
              onChange={(e) => update({ gtmContainerId: e.target.value })}
              onBlur={(e) => persist({ gtm_container_id: e.target.value.trim() })}
              placeholder={t('connect.gtmContainerIdPlaceholder')}
              className="mt-2.5 w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition-colors"
        >
          {t('common.back')}
        </button>
        <button
          type="button"
          onClick={goNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
        >
          {t('common.next')}
        </button>
      </div>

      <GoogleCloudSetupModal open={cloudOpen} onClose={() => setCloudOpen(false)} />
    </div>
  )
}
