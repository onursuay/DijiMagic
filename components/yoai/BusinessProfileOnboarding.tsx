'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, X, Plus, Trash2, ArrowRight, ArrowLeft, CheckCircle2, Building2, MapPin, Target, Globe, ChevronDown, Check } from 'lucide-react'
import type { SectorMainItem } from '@/lib/yoai/sectorCatalog'
import { isValidCompetitorReference, MIN_COMPETITORS_REQUIRED } from '@/lib/yoai/businessProfileValidation'
import type { WizardSelectOption } from '@/components/meta/wizard/WizardSelect'

interface CompetitorDraft {
  competitor_name: string
  website_url: string
  instagram_url: string
  facebook_url: string
  linkedin_url: string
  youtube_url: string
  tiktok_url: string
  google_business_url: string
  extra_url: string
}

const EMPTY_COMP: CompetitorDraft = {
  competitor_name: '',
  website_url: '',
  instagram_url: '',
  facebook_url: '',
  linkedin_url: '',
  youtube_url: '',
  tiktok_url: '',
  google_business_url: '',
  extra_url: '',
}

interface ProfileDraft {
  company_name: string
  sector_main: string
  sector_sub: string
  specialization: string
  business_description: string
  main_conversion_goal: string
  target_locations: string[]
  target_audience: string
  // brand sources
  website_url: string
  instagram_url: string
  facebook_url: string
  linkedin_url: string
  youtube_url: string
  tiktok_url: string
  google_business_profile_url: string
  marketplace_url: string
  // marketing context
  keywords: string[]
  products_or_services: string[]
  most_profitable_services: string[]
  monthly_ad_budget_range: string
  brand_tone: string
  forbidden_claims: string[]
  compliance_notes: string
  extra_notes: string
}

const EMPTY_PROFILE: ProfileDraft = {
  company_name: '',
  sector_main: '',
  sector_sub: '',
  specialization: '',
  business_description: '',
  main_conversion_goal: '',
  target_locations: [],
  target_audience: '',
  website_url: '',
  instagram_url: '',
  facebook_url: '',
  linkedin_url: '',
  youtube_url: '',
  tiktok_url: '',
  google_business_profile_url: '',
  marketplace_url: '',
  keywords: [],
  products_or_services: [],
  most_profitable_services: [],
  monthly_ad_budget_range: '',
  brand_tone: '',
  forbidden_claims: [],
  compliance_notes: '',
  extra_notes: '',
}

const STEP_KEYS = ['company', 'sector', 'goal', 'sources', 'competitors', 'detail'] as const
const STEP_COUNT = STEP_KEYS.length
const STEP_ICONS = [Building2, Target, MapPin, Globe, CheckCircle2, ArrowRight] as const

const INPUT_CLASS = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed'
const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none leading-6`
const COMPACT_INPUT_CLASS = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all'
const CARD_CLASS = 'border border-gray-200 rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:border-gray-300'

function CommaSeparatedInput({ value, onChange, placeholder, className }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; className?: string }) {
  const [raw, setRaw] = useState(value.join(', '))
  useEffect(() => { setRaw(value.join(', ')) }, [value.join(',')])
  return (
    <input
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => onChange(raw.split(',').map((s) => s.trim()).filter(Boolean))}
      placeholder={placeholder}
      className={className}
    />
  )
}

// value (kaydedilen/persist edilen değer) DEĞİŞMEZ; yalnız label i18n'den gelir.
const MAIN_CONVERSION_VALUES = [
  'Telefon araması',
  'Online rezervasyon',
  'Randevu',
  'Lead formu',
  'WhatsApp mesajı',
  'Satış',
  'Mağaza ziyareti',
] as const
const MAIN_CONVERSION_KEYS = [
  'phoneCall',
  'onlineReservation',
  'appointment',
  'leadForm',
  'whatsappMessage',
  'sale',
  'storeVisit',
] as const

const MONTHLY_BUDGET_VALUES = ['0-2k', '2k-5k', '5k-15k', '15k-50k', '50k+'] as const
const MONTHLY_BUDGET_KEYS = ['range0to2k', 'range2kTo5k', 'range5kTo15k', 'range15kTo50k', 'range50kPlus'] as const

const BRAND_TONE_VALUES = [
  'profesyonel/kurumsal',
  'sıcak/aile dostu',
  'genç/enerjik',
  'lüks/premium',
  'uzman/teknik',
] as const
const BRAND_TONE_KEYS = [
  'professionalCorporate',
  'warmFamilyFriendly',
  'youngEnergetic',
  'luxuryPremium',
  'expertTechnical',
] as const

function withCurrentOption(options: WizardSelectOption[], value: string): WizardSelectOption[] {
  if (!value || options.some((o) => o.value === value)) return options
  return [{ value, label: value }, ...options]
}

interface Props {
  /**
   * Called once the profile is saved successfully.
   * Modal closes itself; parent should refresh business context.
   */
  onComplete: () => void
  /**
   * Optional close — only allowed when the profile is already complete and
   * the user just wants to update it. New users cannot close the modal.
   */
  onClose?: () => void
  /**
   * If true, profile already exists — modal is being used in edit mode.
   * The close button becomes available.
   */
  isEditMode?: boolean
}

export default function BusinessProfileOnboarding({ onComplete, onClose, isEditMode = false }: Props) {
  const t = useTranslations('dashboard.yoai.businessProfile')
  const tc = useTranslations('common')
  const stepLabels = [t('steps.company'), t('steps.sector'), t('steps.goal'), t('steps.sources'), t('steps.competitors'), t('steps.detail')]
  const mainConversionOptions: WizardSelectOption[] = MAIN_CONVERSION_VALUES.map((value, i) => ({ value, label: t(`conversionGoals.${MAIN_CONVERSION_KEYS[i]}`) }))
  const monthlyBudgetOptions: WizardSelectOption[] = MONTHLY_BUDGET_VALUES.map((value, i) => ({ value, label: t(`budgetRanges.${MONTHLY_BUDGET_KEYS[i]}`) }))
  const brandToneOptions: WizardSelectOption[] = BRAND_TONE_VALUES.map((value, i) => ({ value, label: t(`brandTones.${BRAND_TONE_KEYS[i]}`) }))
  const competitorStepError = t('competitors.minError', { count: MIN_COMPETITORS_REQUIRED })
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_PROFILE)
  const [competitors, setCompetitors] = useState<CompetitorDraft[]>([{ ...EMPTY_COMP }, { ...EMPTY_COMP }, { ...EMPTY_COMP }])
  const [sectors, setSectors] = useState<SectorMainItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [bootstrapped, setBootstrapped] = useState(false)

  // Bootstrap: load sectors + existing profile (edit mode)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sectorsRes = await fetch('/api/yoai/business-profile/sectors')
        const sectorsJson = await sectorsRes.json()
        if (!cancelled && sectorsJson.ok && Array.isArray(sectorsJson.data)) {
          setSectors(sectorsJson.data)
        }
        const profileRes = await fetch('/api/yoai/business-profile')
        const profileJson = await profileRes.json()
        if (!cancelled && profileJson.ok && profileJson.data?.profile) {
          const p = profileJson.data.profile
          setDraft({
            company_name: p.company_name || '',
            sector_main: p.sector_main || '',
            sector_sub: p.sector_sub || '',
            specialization: p.specialization || '',
            business_description: p.business_description || '',
            main_conversion_goal: p.main_conversion_goal || '',
            target_locations: p.target_locations || [],
            target_audience: p.target_audience || '',
            website_url: p.website_url || '',
            instagram_url: p.instagram_url || '',
            facebook_url: p.facebook_url || '',
            linkedin_url: p.linkedin_url || '',
            youtube_url: p.youtube_url || '',
            tiktok_url: p.tiktok_url || '',
            google_business_profile_url: p.google_business_profile_url || '',
            marketplace_url: p.marketplace_url || '',
            keywords: p.keywords || [],
            products_or_services: p.products_or_services || [],
            most_profitable_services: p.most_profitable_services || [],
            monthly_ad_budget_range: p.monthly_ad_budget_range || '',
            brand_tone: p.brand_tone || '',
            forbidden_claims: p.forbidden_claims || [],
            compliance_notes: p.compliance_notes || '',
            extra_notes: p.extra_notes || '',
          })
          if (Array.isArray(profileJson.data?.competitors) && profileJson.data.competitors.length > 0) {
            const mapped = profileJson.data.competitors.map((c: any) => ({
              competitor_name: c.competitor_name || '',
              website_url: c.website_url || '',
              instagram_url: c.instagram_url || '',
              facebook_url: c.facebook_url || '',
              linkedin_url: c.linkedin_url || '',
              youtube_url: c.youtube_url || '',
              tiktok_url: c.tiktok_url || '',
              google_business_url: c.google_business_url || '',
              extra_url: c.extra_url || '',
            }))
            // Ensure at least 3 rows in form
            while (mapped.length < 3) mapped.push({ ...EMPTY_COMP })
            setCompetitors(mapped)
          }
        }
      } catch (e) {
        console.warn('[Onboarding] bootstrap failed (non-fatal):', e)
      } finally {
        if (!cancelled) setBootstrapped(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ESC ile kapatma — onClose verilmişse çalışır. onboarding tamamlanmış sayılmaz.
  useEffect(() => {
    if (!onClose) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const subSectors = useMemo(() => {
    const main = sectors.find((s) => s.id === draft.sector_main)
    return main?.subs || []
  }, [sectors, draft.sector_main])
  const sectorOptions = useMemo<WizardSelectOption[]>(
    () => sectors.map((s) => ({ value: s.id, label: s.label })),
    [sectors],
  )
  const subSectorOptions = useMemo<WizardSelectOption[]>(
    () => subSectors.map((s) => ({ value: s.id, label: s.label })),
    [subSectors],
  )
  const validCompetitorCount = useMemo(
    () => competitors.filter(isValidCompetitorReference).length,
    [competitors],
  )

  // ── Field helpers ──
  const setField = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }
  const updateCompetitor = <K extends keyof CompetitorDraft>(idx: number, key: K, value: CompetitorDraft[K]) => {
    setCompetitors((arr) => arr.map((c, i) => (i === idx ? { ...c, [key]: value } : c)))
  }
  const addCompetitor = () => setCompetitors((arr) => [...arr, { ...EMPTY_COMP }])
  const removeCompetitor = (idx: number) => setCompetitors((arr) => (arr.length <= 1 ? arr : arr.filter((_, i) => i !== idx)))

  // ── Step validation (light, full validation server-side) ──
  const stepValid = useMemo(() => {
    if (step === 0) return draft.company_name.trim().length > 0 && draft.business_description.trim().length >= 10
    if (step === 1) return draft.sector_main.trim().length > 0
    if (step === 2) return draft.target_locations.length > 0 && draft.main_conversion_goal.trim().length > 0
    if (step === 3) {
      return [
        draft.website_url, draft.instagram_url, draft.facebook_url,
        draft.linkedin_url, draft.youtube_url, draft.tiktok_url,
        draft.google_business_profile_url, draft.marketplace_url,
      ].some((v) => v.trim().length > 0)
    }
    if (step === 4) {
      return validCompetitorCount >= MIN_COMPETITORS_REQUIRED
    }
    return true
  }, [step, draft, validCompetitorCount])

  const handleNext = () => {
    setErrors([])
    if (step === 4 && validCompetitorCount < MIN_COMPETITORS_REQUIRED) {
      setErrors([competitorStepError])
      return
    }
    if (!stepValid) return
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1))
  }

  const submit = async () => {
    setSubmitting(true)
    setErrors([])
    try {
      const res = await fetch('/api/yoai/business-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          competitors: competitors.filter(isValidCompetitorReference),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        const errorList = Array.isArray(json.errors) ? json.errors : [json.detail ? `${json.error}: ${json.detail}` : json.error || t('errors.saveFailed')]
        setErrors(errorList)
        return
      }
      onComplete()
    } catch (e) {
      setErrors([t('errors.serverUnreachable')])
    } finally {
      setSubmitting(false)
    }
  }

  if (!bootstrapped) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm">
        <div className="absolute inset-0 left-64 flex items-center justify-center">
          <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-xl">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <p className="text-sm text-gray-700">{tc('loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="bg-white w-full max-w-3xl rounded-t-3xl md:rounded-3xl shadow-2xl my-0 md:my-4 max-h-[95vh] min-h-[70vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 bg-white">
          <div className="flex-1">
            <h2 id="onboarding-title" className="text-lg font-semibold text-gray-900">{t('title')}</h2>
            <p className="text-xs text-gray-500 mt-1">{t('subtitle')}</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="ml-3 p-2 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" aria-label={tc('close')}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/40">
          <div className="flex items-center gap-1 overflow-x-auto">
            {STEP_KEYS.map((stepKey, idx) => {
              const label = stepLabels[idx]
              const Icon = STEP_ICONS[idx]
              const active = idx === step
              const done = idx < step
              return (
                <div key={stepKey} className="flex items-center gap-2 shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${done ? 'bg-primary text-white shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.18)]' : active ? 'bg-white border-2 border-primary text-primary shadow-[0_0_0_4px_rgba(var(--color-primary-rgb),0.12),0_2px_8px_rgba(0,0,0,0.10)]' : 'bg-white border-2 border-gray-200 text-gray-400 shadow-sm'}`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-[12px] font-medium transition-colors ${active ? 'text-primary' : done ? 'text-primary/70' : 'text-gray-400'}`}>{label}</span>
                  {idx < STEP_COUNT - 1 && <span className="w-4 h-px bg-gray-200" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {/* STEP 0: Firma + açıklama */}
          {step === 0 && (
            <div className="space-y-4">
              <Field label={t('fields.companyName')}>
                <input value={draft.company_name} onChange={(e) => setField('company_name', e.target.value)} placeholder={t('placeholders.companyName')}
                  className={INPUT_CLASS} />
              </Field>
              <Field label={t('fields.businessDescription')}>
                <textarea value={draft.business_description} onChange={(e) => setField('business_description', e.target.value)} rows={4}
                  placeholder={t('placeholders.businessDescription')}
                  className={TEXTAREA_CLASS} />
                <p className="text-[11px] text-gray-500 mt-1.5">{t('hints.businessDescription')}</p>
              </Field>
              <Field label={t('fields.productsOrServices')}>
                <CommaSeparatedInput value={draft.products_or_services} onChange={(v) => setField('products_or_services', v)}
                  placeholder={t('placeholders.productsOrServices')}
                  className={INPUT_CLASS} />
              </Field>
            </div>
          )}

          {/* STEP 1: Sektör */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label={t('fields.sectorMain')}>
                <BusinessProfileSelect
                  value={draft.sector_main}
                  onChange={(value) => { setField('sector_main', value); setField('sector_sub', '') }}
                  options={sectorOptions}
                  placeholder={tc('selectPlaceholder')}
                  disabled={sectors.length === 0}
                />
              </Field>
              <Field label={t('fields.sectorSub')}>
                <BusinessProfileSelect
                  value={draft.sector_sub}
                  onChange={(value) => setField('sector_sub', value)}
                  options={subSectorOptions}
                  placeholder={subSectors.length === 0 ? t('placeholders.selectMainSectorFirst') : tc('selectPlaceholder')}
                  disabled={subSectors.length === 0}
                />
              </Field>
              <Field label={t('fields.specialization')}>
                <input value={draft.specialization} onChange={(e) => setField('specialization', e.target.value)}
                  placeholder={t('placeholders.specialization')}
                  className={INPUT_CLASS} />
              </Field>
            </div>
          )}

          {/* STEP 2: Hedef + lokasyon */}
          {step === 2 && (
            <div className="space-y-4">
              <Field label={t('fields.mainConversionGoal')}>
                <BusinessProfileSelect
                  value={draft.main_conversion_goal}
                  onChange={(value) => setField('main_conversion_goal', value)}
                  options={withCurrentOption(mainConversionOptions, draft.main_conversion_goal)}
                  placeholder={tc('selectPlaceholder')}
                />
              </Field>
              <Field label={t('fields.targetLocations')}>
                <CommaSeparatedInput value={draft.target_locations} onChange={(v) => setField('target_locations', v)}
                  placeholder={t('placeholders.targetLocations')}
                  className={INPUT_CLASS} />
              </Field>
              <Field label={t('fields.targetAudience')}>
                <textarea value={draft.target_audience} onChange={(e) => setField('target_audience', e.target.value)} rows={2}
                  placeholder={t('placeholders.targetAudience')}
                  className={TEXTAREA_CLASS} />
              </Field>
            </div>
          )}

          {/* STEP 3: Marka kaynakları */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 -mt-1">{t('sources.intro')}</p>
              <SourceField label={t('sources.website')} value={draft.website_url} onChange={(v) => setField('website_url', v)} placeholder="https://..." />
              <SourceField label="Instagram" value={draft.instagram_url} onChange={(v) => setField('instagram_url', v)} placeholder="https://instagram.com/..." />
              <SourceField label="Facebook" value={draft.facebook_url} onChange={(v) => setField('facebook_url', v)} placeholder="https://facebook.com/..." />
              <SourceField label="LinkedIn" value={draft.linkedin_url} onChange={(v) => setField('linkedin_url', v)} placeholder="https://linkedin.com/company/..." />
              <SourceField label="YouTube" value={draft.youtube_url} onChange={(v) => setField('youtube_url', v)} placeholder="https://youtube.com/..." />
              <SourceField label="TikTok" value={draft.tiktok_url} onChange={(v) => setField('tiktok_url', v)} placeholder="https://tiktok.com/@..." />
              <SourceField label={t('sources.googleBusiness')} value={draft.google_business_profile_url} onChange={(v) => setField('google_business_profile_url', v)} placeholder="https://g.page/..." />
              <SourceField label={t('sources.marketplace')} value={draft.marketplace_url} onChange={(v) => setField('marketplace_url', v)} placeholder="https://..." />
            </div>
          )}

          {/* STEP 4: Rakipler */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-600">{t('competitors.intro', { count: MIN_COMPETITORS_REQUIRED })}</p>
                <p className={`mt-1 text-[11px] font-medium ${validCompetitorCount >= MIN_COMPETITORS_REQUIRED ? 'text-primary' : 'text-red-600'}`}>
                  {t('competitors.validCount', { valid: validCompetitorCount, required: MIN_COMPETITORS_REQUIRED })}
                </p>
              </div>
              {competitors.map((c, idx) => (
                <div key={idx} className={`${CARD_CLASS} p-3 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">{t('competitors.itemLabel', { index: idx + 1 })}</span>
                    {competitors.length > 1 && (
                      <button type="button" onClick={() => removeCompetitor(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label={t('competitors.removeAria', { index: idx + 1 })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input value={c.competitor_name} onChange={(e) => updateCompetitor(idx, 'competitor_name', e.target.value)} placeholder={t('competitors.namePlaceholder')}
                    className={COMPACT_INPUT_CLASS} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input value={c.website_url} onChange={(e) => updateCompetitor(idx, 'website_url', e.target.value)} placeholder={t('competitors.websitePlaceholder')}
                      className={COMPACT_INPUT_CLASS} />
                    <input value={c.instagram_url} onChange={(e) => updateCompetitor(idx, 'instagram_url', e.target.value)} placeholder="Instagram"
                      className={COMPACT_INPUT_CLASS} />
                    <input value={c.facebook_url} onChange={(e) => updateCompetitor(idx, 'facebook_url', e.target.value)} placeholder="Facebook"
                      className={COMPACT_INPUT_CLASS} />
                    <input value={c.linkedin_url} onChange={(e) => updateCompetitor(idx, 'linkedin_url', e.target.value)} placeholder="LinkedIn"
                      className={COMPACT_INPUT_CLASS} />
                    <input value={c.youtube_url} onChange={(e) => updateCompetitor(idx, 'youtube_url', e.target.value)} placeholder="YouTube"
                      className={COMPACT_INPUT_CLASS} />
                    <input value={c.tiktok_url} onChange={(e) => updateCompetitor(idx, 'tiktok_url', e.target.value)} placeholder="TikTok"
                      className={COMPACT_INPUT_CLASS} />
                    <input value={c.google_business_url} onChange={(e) => updateCompetitor(idx, 'google_business_url', e.target.value)} placeholder={t('competitors.googleBusinessPlaceholder')}
                      className={COMPACT_INPUT_CLASS} />
                    <input value={c.extra_url} onChange={(e) => updateCompetitor(idx, 'extra_url', e.target.value)} placeholder={t('competitors.otherLinkPlaceholder')}
                      className={COMPACT_INPUT_CLASS} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addCompetitor} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-primary border border-primary/20 rounded-lg hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors">
                <Plus className="w-3.5 h-3.5" /> {t('competitors.add')}
              </button>
            </div>
          )}

          {/* STEP 5: Detay */}
          {step === 5 && (
            <div className="space-y-4">
              <Field label={t('fields.keywords')}>
                <CommaSeparatedInput value={draft.keywords} onChange={(v) => setField('keywords', v)}
                  placeholder={t('placeholders.keywords')}
                  className={INPUT_CLASS} />
              </Field>
              <Field label={t('fields.mostProfitableServices')}>
                <CommaSeparatedInput value={draft.most_profitable_services} onChange={(v) => setField('most_profitable_services', v)}
                  placeholder={t('placeholders.mostProfitableServices')}
                  className={INPUT_CLASS} />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t('fields.monthlyAdBudget')}>
                  <BusinessProfileSelect
                    value={draft.monthly_ad_budget_range}
                    onChange={(value) => setField('monthly_ad_budget_range', value)}
                    options={monthlyBudgetOptions}
                    placeholder={tc('selectPlaceholder')}
                  />
                </Field>
                <Field label={t('fields.brandTone')}>
                  <BusinessProfileSelect
                    value={draft.brand_tone}
                    onChange={(value) => setField('brand_tone', value)}
                    options={withCurrentOption(brandToneOptions, draft.brand_tone)}
                    placeholder={tc('selectPlaceholder')}
                  />
                </Field>
              </div>
              <Field label={t('fields.forbiddenClaims')}>
                <CommaSeparatedInput value={draft.forbidden_claims} onChange={(v) => setField('forbidden_claims', v)}
                  placeholder={t('placeholders.forbiddenClaims')}
                  className={INPUT_CLASS} />
              </Field>
              <Field label={t('fields.complianceNotes')}>
                <textarea value={draft.compliance_notes} onChange={(e) => setField('compliance_notes', e.target.value)} rows={2}
                  placeholder={t('placeholders.complianceNotes')}
                  className={TEXTAREA_CLASS} />
              </Field>
              <Field label={t('fields.extraNotes')}>
                <textarea value={draft.extra_notes} onChange={(e) => setField('extra_notes', e.target.value)} rows={2}
                  placeholder={t('placeholders.extraNotes')}
                  className={TEXTAREA_CLASS} />
              </Field>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <ul className="list-disc pl-5 text-xs text-red-700 space-y-0.5">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <ArrowLeft className="w-4 h-4" /> {tc('back')}
          </button>
          <div className="text-xs text-gray-500">{step + 1} / {STEP_COUNT}</div>
          {step < STEP_COUNT - 1 ? (
            <button type="button" onClick={handleNext} disabled={submitting || (step !== 4 && !stepValid)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {tc('continue')} <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={!stepValid || submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {t('saveProfile')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SourceField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={INPUT_CLASS} />
    </div>
  )
}

function BusinessProfileSelect({
  value,
  onChange,
  options,
  disabled = false,
  error = false,
  placeholder = '',
}: {
  value: string
  onChange: (v: string) => void
  options: WizardSelectOption[]
  disabled?: boolean
  error?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((current) => !current)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setOpen(false)
        }}
        className={`
          w-full flex items-center justify-between px-3.5 py-2.5 border rounded-xl text-sm text-left transition-all
          shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)]
          ${open ? 'border-primary ring-2 ring-primary/20' : error ? 'border-red-400 ring-1 ring-red-300' : 'border-gray-200 hover:border-gray-300'}
          ${disabled ? 'bg-gray-50 opacity-60 cursor-not-allowed text-gray-500' : 'bg-white cursor-pointer'}
        `}
      >
        <span className={selected ? 'text-gray-800 font-medium' : 'text-gray-400'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 mr-0.5 ${open ? 'rotate-180 text-primary' : 'text-gray-400'}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-[80] w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] max-h-64 overflow-y-auto py-1"
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (option.disabled) return
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`
                  w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors
                  ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}
                  ${isSelected ? 'bg-primary/8 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'}
                `}
              >
                <span>{option.label}</span>
                {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
