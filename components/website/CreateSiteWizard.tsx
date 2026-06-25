'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { X, Info, Sparkles, Wand2, ImagePlus, Trash2, AlertCircle } from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import DictateButton from '@/components/website/DictateButton'
import { FONT_PAIRINGS, FONT_PAIRING_LIST, SITE_STYLE_PRESETS } from '@/lib/website/render/theme'
import type { SiteType } from '@/lib/website/types'

// Tarz temsili noktalar (DijiMagic UI — amber/sarı yok).
const STYLE_DOT: Record<string, string> = {
  modern: '#0E7C73', corporate: '#2C57A8', playful: '#B23A6B', luxury: '#1A2E45', minimal: '#18202B', vibrant: '#159A47',
}

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

interface CreateSiteWizardProps {
  open: boolean
  onClose: () => void
}

/**
 * Tek-ekran site oluşturma sihirbazı. Tüm alanlar (ad/tür/dil/font/referans/tarif/logo) tek
 * ekranda; arka plan blur; çerçevede dönen yeşil shimmer. "AI ile Oluştur" → taslak + logo +
 * üretim akışını başlatır ve detay sayfasına (?create=ai) yönlendirir (orada review modu).
 */
export default function CreateSiteWizard({ open, onClose }: CreateSiteWizardProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const uiLocale = useLocale()
  const router = useRouter()

  const [label, setLabel] = useState('')
  const [siteType, setSiteType] = useState<SiteType>('multipage')
  const [locales, setLocales] = useState<string[]>(['tr'])
  const [fontPairing, setFontPairing] = useState<string>('elegant')
  const [siteStyle, setSiteStyle] = useState<string>('modern')
  const [mobileMenuAnim, setMobileMenuAnim] = useState<'left' | 'right' | 'top'>('left')
  const [refUrls, setRefUrls] = useState<string[]>(['', '', ''])
  // Veri önceliği — kullanıcı açıkça seçti mi? Seçmediyse referans URL durumuna göre
  // otomatik türetilir (en az 1 referans URL varsa 'reference', yoksa 'manual').
  const [dataSourcePriority, setDataSourcePriority] = useState<'reference' | 'manual'>('reference')
  const [priorityTouched, setPriorityTouched] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [busy, setBusy] = useState<'ai' | 'quick' | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setLabel(''); setSiteType('multipage'); setLocales(['tr']); setFontPairing('elegant'); setSiteStyle('modern')
      setMobileMenuAnim('left')
      setRefUrls(['', '', '']); setDataSourcePriority('reference'); setPriorityTouched(false)
      setInstructions(''); setLogoFile(null); setLogoPreview(''); setBusy(null); setError('')
    }
  }, [open])

  // Kullanıcı önceliği elle değiştirmediyse, referans URL durumuna göre otomatik türet:
  // en az bir referans URL girilmişse 'reference', hiç yoksa 'manual'.
  const hasAnyRef = refUrls.some((u) => u.trim().length > 0)
  useEffect(() => {
    if (!priorityTouched) setDataSourcePriority(hasAnyRef ? 'reference' : 'manual')
  }, [hasAnyRef, priorityTouched])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose, busy])

  if (!open) return null

  const addLocale = (code: string) => setLocales((prev) => (prev.includes(code) ? prev : [...prev, code]))
  const removeLocale = (code: string) => { if (code !== 'tr') setLocales((prev) => prev.filter((x) => x !== code)) }
  const availableLangs = LANGS.filter((l) => !locales.includes(l.code))
  const setRef = (i: number, v: string) => setRefUrls((prev) => prev.map((x, idx) => (idx === i ? v : x)))
  const pickStyle = (id: string) => {
    setSiteStyle(id)
    const p = SITE_STYLE_PRESETS.find((s) => s.id === id)
    if (p) setFontPairing(p.fontHint) // tarza uygun yazı ailesi varsayılanı (kullanıcı değiştirebilir)
  }

  const onLogoPick = (file: File | undefined) => {
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const submit = async (mode: 'ai' | 'quick') => {
    setBusy(mode); setError('')
    try {
      const ordered = ['tr', ...locales.filter((l) => l !== 'tr')]
      const pair = FONT_PAIRINGS[fontPairing] ?? FONT_PAIRINGS.elegant
      const references = refUrls.map((u) => u.trim()).filter(Boolean)
      const res = await fetch('/api/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim() || t('defaultName'),
          siteType,
          defaultLocale: ordered[0],
          locales: ordered,
          theme: {
            fontHeading: pair.heading,
            fontBody: pair.body,
            fontHref: pair.href,
            referenceUrls: references,
            // Veri önceliği — üretimde HANGİ kaynağın yetkili olacağı (referans / manuel).
            dataSourcePriority,
            initialInstructions: instructions.trim() || null,
            style: siteStyle,
            mobileMenuAnim,
          },
        }),
      })
      const json = await res.json()
      if (!json.ok || !json.website) { setError(t('createError')); setBusy(null); return }
      const id = json.website.id as string
      if (logoFile) {
        const fd = new FormData()
        fd.append('file', logoFile)
        await fetch(`/api/website/${id}/logo`, { method: 'POST', body: fd }).catch(() => {})
      }
      router.push(`/web-site-yoneticisi/${id}?create=${mode}`)
    } catch {
      setError(t('createError')); setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      {/* Arka plan blur */}
      <div className="fixed inset-0 bg-black/55 backdrop-blur-md" onClick={() => !busy && onClose()} />

      {/* Wizard kartı (beyaz, overflow-hidden) + dönen yeşil shimmer kenar. Google snake deseni:
          snake absolute kenar ring + içerik şeffaf z-10 → ring içeriğin altından görünür. */}
      <div className="relative w-full max-w-2xl my-6 rounded-[1.75rem] bg-white overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)]">
        <div className="wizard-snake-border rounded-[1.75rem]" aria-hidden />
        <div className="relative z-10">
          {/* Başlık */}
          <div className="flex items-start justify-between gap-4 px-7 pt-7">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Wand2 className="w-5 h-5 text-primary" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{t('wizardTitle')}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{t('wizardSubtitle')}</p>
              </div>
            </div>
            <button
              onClick={() => !busy && onClose()}
              disabled={busy !== null}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 mt-1"
              aria-label={t('cancel')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-7 py-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Site adı */}
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('nameLabel')}</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('namePlaceholder')}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Tarz */}
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('styleLabel')}</label>
              <p className="text-xs text-gray-500 mt-0.5">{t('styleHint')}</p>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SITE_STYLE_PRESETS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickStyle(s.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                      siteStyle === s.id
                        ? 'border-primary bg-primary/5 text-primary font-medium ring-2 ring-primary/20'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50/60'
                    }`}
                  >
                    <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: STYLE_DOT[s.id] }} />
                    {t(`style_${s.id}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Tür + Yazı stili */}
            <div className="grid sm:grid-cols-2 gap-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('fontLabel')}</label>
                <WizardSelect
                  value={fontPairing}
                  onChange={setFontPairing}
                  searchable
                  searchPlaceholder={t('fontSearch')}
                  options={FONT_PAIRING_LIST.map((p) => ({ value: p.id, label: p.label }))}
                />
              </div>
            </div>

            {/* Mobil menü açılış animasyonu */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('mobileMenuAnimLabel')}</label>
              <WizardSelect
                value={mobileMenuAnim}
                onChange={(v) => setMobileMenuAnim(v as 'left' | 'right' | 'top')}
                options={[
                  { value: 'left', label: t('mobileMenuAnimLeft') },
                  { value: 'right', label: t('mobileMenuAnimRight') },
                  { value: 'top', label: t('mobileMenuAnimTop') },
                ]}
              />
              <p className="text-xs text-gray-500 mt-1.5">{t('mobileMenuAnimHint')}</p>
            </div>

            {/* Diller */}
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('languagesLabel')}</label>
              <p className="text-xs text-gray-500 mt-0.5">{t('languagesHint')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {locales.map((code) => (
                  <span key={code} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 text-sm">
                    {langName(code)}
                    {code !== 'tr' && (
                      <button type="button" onClick={() => removeLocale(code)} aria-label={langName(code)} className="text-primary/60 hover:text-primary">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {availableLangs.length > 0 && (
                <div className="mt-2">
                  <WizardSelect value="" onChange={addLocale} searchable searchPlaceholder={t('languageSearch')} placeholder={t('addLanguage')} options={availableLangs.map((l) => ({ value: l.code, label: l.name }))} />
                </div>
              )}
            </div>

            {/* Marka açıklaması / tarif + Sesle yaz */}
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('descLabel')}</label>
              <p className="text-xs text-gray-500 mt-0.5">{t('descHint')}</p>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                placeholder={t('descPlaceholder')}
                className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-sm leading-relaxed focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
              <div className="mt-2">
                <DictateButton
                  onAppend={(text) => setInstructions((prev) => (prev ? `${prev} ${text}` : text))}
                  lang={uiLocale === 'en' ? 'en-US' : 'tr-TR'}
                  labelStart={t('dictate')}
                  labelStop={t('listening')}
                  labelPause={t('stopDictate')}
                />
              </div>
            </div>

            {/* Logo (opsiyonel) */}
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
              <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt={t('logoLabel')} className="w-full h-full object-contain" />
                ) : (
                  <ImagePlus className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{t('logoLabel')}</p>
                <p className="text-xs text-gray-500 truncate">{t('logoHint')}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { onLogoPick(e.target.files?.[0]); e.target.value = '' }} />
                <button onClick={() => fileRef.current?.click()} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50">
                  <ImagePlus className="w-4 h-4" />
                  {logoPreview ? t('logoChange') : t('logoUpload')}
                </button>
                {logoPreview && (
                  <button onClick={() => { setLogoFile(null); setLogoPreview('') }} disabled={busy !== null} aria-label={t('logoRemove')} className="rounded-lg border border-gray-200 text-gray-500 p-2 hover:bg-gray-50/60 transition-colors disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Referans siteler */}
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('refLabel')}</label>
              <p className="text-xs text-gray-500 mt-0.5">{t('refHint')}</p>
              <div className="mt-2 space-y-2">
                {refUrls.map((u, i) => (
                  <input key={i} value={u} onChange={(e) => setRef(i, e.target.value)} placeholder={t('refPlaceholder')} inputMode="url" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                ))}
              </div>
              <div className="mt-2 flex gap-2 rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-gray-600">{t('refWizardHint')}</p>
              </div>
            </div>

            {/* Veri önceliği — üretim hangi kaynağa göre inşa edilsin? */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('dataPriorityLabel')}</label>
              <WizardSelect
                value={dataSourcePriority}
                onChange={(v) => { setPriorityTouched(true); setDataSourcePriority(v as 'reference' | 'manual') }}
                options={[
                  { value: 'reference', label: t('dataPriorityReference') },
                  { value: 'manual', label: t('dataPriorityManual') },
                ]}
              />
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                {dataSourcePriority === 'reference' ? t('dataPriorityReferenceHint') : t('dataPriorityManualHint')}
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
          </div>

          {/* Aksiyonlar */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 px-7 py-5 border-t border-gray-100 bg-gray-50/40">
            <button onClick={() => !busy && onClose()} disabled={busy !== null} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
              {t('cancel')}
            </button>
            <button onClick={() => submit('quick')} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50">
              {busy === 'quick' ? t('creating') : t('quickCreateCta')}
            </button>
            <button onClick={() => submit('ai')} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white active:scale-[0.97] transition-all disabled:opacity-60">
              <Sparkles className={`w-4 h-4 ${busy === 'ai' ? 'animate-pulse' : ''}`} />
              {busy === 'ai' ? t('creating') : t('aiCreateCta')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
