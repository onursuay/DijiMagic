'use client'

import { useTranslations } from 'next-intl'
import {
  CheckCircle2,
  Tags,
  BarChart3,
  Building2,
  Search,
  Globe,
} from 'lucide-react'
import { STANDARD_EVENTS, getEventDef } from '@/lib/marketing-setup/constants'
import type { StepProps } from '@/components/marketing-setup/wizardTypes'

export default function ConfigPreview({ state, goNext, goBack }: StepProps) {
  const t = useTranslations('marketingSetup')

  const conn = state.connections
  const selectedDefs = STANDARD_EVENTS.filter((e) => state.selectedEvents.includes(e.key))
  const conversionDefs = selectedDefs.filter((e) => e.isConversion)

  const googleConnected = !!(conn?.googleAds.connected || conn?.ga4.connected || conn?.gsc.connected)
  const metaConnected = !!conn?.meta.connected
  const gscConnected = !!conn?.gsc.connected
  const adsConnected = !!conn?.googleAds.connected

  const eventLabels = selectedDefs.map((d) => t(`events.${d.i18nKey}`))

  // A single preview line.
  const Line = ({ label, detail }: { label: string; detail?: string }) => (
    <li className="flex items-start gap-2.5 py-1.5">
      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
      <span className="text-sm text-gray-700">
        {label}
        {detail && <span className="block text-xs text-gray-400 mt-0.5">{detail}</span>}
      </span>
    </li>
  )

  const Group = ({
    icon,
    title,
    enabled,
    children,
  }: {
    icon: React.ReactNode
    title: string
    enabled: boolean
    children: React.ReactNode
  }) => (
    <div
      className={`bg-white border rounded-2xl p-5 shadow-sm ${
        enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'
      }`}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {!enabled && (
          <span className="ml-auto text-xs text-gray-400">{t('common.notConnected')}</span>
        )}
      </div>
      <ul className="divide-y divide-gray-50">{children}</ul>
    </div>
  )

  const eventJoin = eventLabels.join(', ')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{t('preview.title')}</h2>
        <p className="mt-1.5 text-sm text-gray-500">{t('preview.description')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* GTM */}
        <Group icon={<Tags className="w-5 h-5" />} title={t('preview.gtm')} enabled>
          <Line label={t('preview.gtmGa4Base')} />
          {metaConnected && <Line label={t('preview.gtmMetaBase')} />}
          {selectedDefs.length > 0 && (
            <Line label={t('preview.gtmEventTag')} detail={eventJoin} />
          )}
        </Group>

        {/* GA4 */}
        <Group icon={<BarChart3 className="w-5 h-5" />} title={t('preview.ga4')} enabled={googleConnected}>
          {conversionDefs.length > 0 && (
            <Line
              label={t('preview.ga4KeyEvents')}
              detail={conversionDefs.map((d) => t(`events.${d.i18nKey}`)).join(', ')}
            />
          )}
          <Line label={t('preview.ga4Audiences')} />
          <Line label={t('preview.ga4CustomDimensions')} />
        </Group>

        {/* Meta */}
        <Group icon={<Building2 className="w-5 h-5" />} title={t('preview.meta')} enabled={metaConnected}>
          <Line label={t('preview.metaPixelSetup')} />
          <Line label={t('preview.metaCapi')} />
          {conversionDefs.length > 0 && (
            <Line
              label={t('preview.metaCustomConversions')}
              detail={conversionDefs.map((d) => t(`events.${d.i18nKey}`)).join(', ')}
            />
          )}
          <Line label={t('preview.metaCustomAudiences')} />
          <Line label={t('preview.metaLookalikes')} />
        </Group>

        {/* Google Ads */}
        <Group icon={<Globe className="w-5 h-5" />} title={t('preview.googleAds')} enabled={adsConnected}>
          {conversionDefs.length > 0 && (
            <Line
              label={t('preview.googleAdsConversions')}
              detail={conversionDefs.map((d) => t(`events.${d.i18nKey}`)).join(', ')}
            />
          )}
          <Line label={t('preview.googleAdsRemarketing')} />
          <Line label={t('preview.googleAdsGa4Import')} />
        </Group>

        {/* GSC */}
        <Group icon={<Search className="w-5 h-5" />} title={t('preview.gsc')} enabled={gscConnected}>
          <Line label={t('preview.gscVerify')} detail={state.siteUrl || undefined} />
        </Group>
      </div>

      {/* Selected events chips */}
      {selectedDefs.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedDefs.map((d) => (
            <span
              key={d.key}
              className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-medium"
            >
              {t(`events.${d.i18nKey}`)}
            </span>
          ))}
        </div>
      )}

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
          {t('preview.confirm')}
        </button>
      </div>
    </div>
  )
}
