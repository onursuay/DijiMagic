'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Info } from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import { FONT_PAIRINGS, FONT_PAIRING_LIST } from '@/lib/website/render/theme'
import type { SiteType, WebsiteDraftInput } from '@/lib/website/types'

const LANGS: { code: string; name: string }[] = [
  { code: 'tr', name: 'Türkçe' }, { code: 'en', name: 'English' }, { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' }, { code: 'es', name: 'Español' }, { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' }, { code: 'nl', name: 'Nederlands' }, { code: 'ru', name: 'Русский' },
  { code: 'pl', name: 'Polski' }, { code: 'sv', name: 'Svenska' }, { code: 'da', name: 'Dansk' },
  { code: 'no', name: 'Norsk' }, { code: 'fi', name: 'Suomi' }, { code: 'el', name: 'Ελληνικά' },
  { code: 'cs', name: 'Čeština' }, { code: 'ro', name: 'Română' }, { code: 'hu', name: 'Magyar' },
  { code: 'uk', name: 'Українська' }, { code: 'bg', name: 'Български' }, { code: 'sr', name: 'Srpski' },
  { code: 'hr', name: 'Hrvatski' }, { code: 'sk', name: 'Slovenčina' }, { code: 'ar', name: 'العربية' },
  { code: 'fa', name: 'فارسی' }, { code: 'he', name: 'עברית' }, { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' }, { code: 'zh', name: '中文' }, { code: 'hi', name: 'हिन्दी' },
  { code: 'th', name: 'ไทย' }, { code: 'id', name: 'Bahasa Indonesia' }, { code: 'vi', name: 'Tiếng Việt' },
  { code: 'az', name: 'Azərbaycanca' },
]
const langName = (code: string) => LANGS.find((l) => l.code === code)?.name ?? code.toUpperCase()

interface NewSiteModalProps {
  open: boolean
  creating: boolean
  onClose: () => void
  onCreate: (input: WebsiteDraftInput) => void
}

export default function NewSiteModal({ open, creating, onClose, onCreate }: NewSiteModalProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const [label, setLabel] = useState('')
  const [siteType, setSiteType] = useState<SiteType>('multipage')
  const [locales, setLocales] = useState<string[]>(['tr'])
  const [fontPairing, setFontPairing] = useState<string>('elegant')
  const [refUrls, setRefUrls] = useState<string[]>(['', '', ''])

  useEffect(() => {
    if (open) {
      setLabel(''); setSiteType('multipage'); setLocales(['tr']); setFontPairing('elegant'); setRefUrls(['', '', ''])
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!open) return null

  const addLocale = (code: string) => setLocales((prev) => (prev.includes(code) ? prev : [...prev, code]))
  const removeLocale = (code: string) => {
    if (code === 'tr') return
    setLocales((prev) => prev.filter((x) => x !== code))
  }
  const availableLangs = LANGS.filter((l) => !locales.includes(l.code))
  const setRef = (i: number, v: string) => setRefUrls((prev) => prev.map((x, idx) => (idx === i ? v : x)))

  const handleCreate = () => {
    const ordered = ['tr', ...locales.filter((l) => l !== 'tr')]
    const pair = FONT_PAIRINGS[fontPairing] ?? FONT_PAIRINGS.elegant
    const references = refUrls.map((u) => u.trim()).filter(Boolean)
    onCreate({
      label: label.trim() || 'Yeni Web Sitesi',
      siteType,
      defaultLocale: ordered[0],
      locales: ordered,
      theme: { fontHeading: pair.heading, fontBody: pair.body, fontHref: pair.href, referenceUrls: references },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{t('modalTitle')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label={t('cancel')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('nameLabel')}</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('typeLabel')}</label>
            <WizardSelect
              value={siteType}
              onChange={(v) => setSiteType(v as SiteType)}
              options={[
                { value: 'multipage', label: t('typeMultipage') },
                { value: 'landing', label: t('typeLanding') },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{t('languagesLabel')}</label>
            <p className="text-xs text-gray-500 mt-0.5">{t('languagesHint')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {locales.map((code) => {
                const locked = code === 'tr'
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 text-sm"
                  >
                    {langName(code)}
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => removeLocale(code)}
                        aria-label={langName(code)}
                        className="text-primary/60 hover:text-primary"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                )
              })}
            </div>
            {availableLangs.length > 0 && (
              <div className="mt-2">
                <WizardSelect
                  value=""
                  onChange={addLocale}
                  searchable
                  searchPlaceholder={t('languageSearch')}
                  placeholder={t('addLanguage')}
                  options={availableLangs.map((l) => ({ value: l.code, label: l.name }))}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('fontLabel')}</label>
            <WizardSelect
              value={fontPairing}
              onChange={setFontPairing}
              searchable
              searchPlaceholder={t('fontSearch')}
              options={FONT_PAIRING_LIST.map((p) => ({ value: p.id, label: p.label }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{t('refLabel')}</label>
            <p className="text-xs text-gray-500 mt-0.5">{t('refHint')}</p>
            <div className="mt-2 space-y-2">
              {refUrls.map((u, i) => (
                <input
                  key={i}
                  value={u}
                  onChange={(e) => setRef(i, e.target.value)}
                  placeholder={t('refPlaceholder')}
                  inputMode="url"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              ))}
            </div>
            <div className="mt-2 flex gap-2 rounded-lg bg-gray-50 border border-gray-200 p-2.5">
              <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-gray-600">{t('refWarning')}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50/60 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {creating ? t('building') : t('create')}
          </button>
        </div>
      </div>
    </div>
  )
}
