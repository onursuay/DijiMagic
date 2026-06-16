'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X, Check, RotateCcw, Palette, AlertTriangle } from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import { FONT_PAIRINGS, FONT_PAIRING_LIST, areaFontHref, onAccentFor } from '@/lib/website/render/theme'
import type { AreaStyle, AreaStyles, ThemeTokens } from '@/lib/website/types'

type Area = 'header' | 'body' | 'footer'
const AREAS: Area[] = ['header', 'body', 'footer']
const SCALE_VALUES = ['0.9', '1', '1.1', '1.25']

/** Geçerli 6 haneli hex (#rrggbb). Picker + örnek + kayıt yalnız geçerli değeri kullanır. */
const isHex = (c: string | null | undefined): c is string => /^#[0-9a-fA-F]{6}$/.test(c || '')

/** WCAG bağıl parlaklık → kontrast oranı (1:1 … 21:1). Okunabilirlik uyarısı için. */
function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
    if (!m) return 1
    const ch = [m[1], m[2], m[3]].map((h) => {
      const s = parseInt(h, 16) / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  }
  const l1 = lum(a), l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function ColorField({ label, value, fallback, placeholder, resetLabel, onChange, onClear }: {
  label: string; value: string | null | undefined; fallback: string; placeholder: string; resetLabel: string
  onChange: (v: string) => void; onClear: () => void
}) {
  const invalid = !!value && !isHex(value)
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={isHex(value) ? value : fallback} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded-lg border border-gray-200 cursor-pointer bg-white p-0.5" />
        <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 transition-all ${invalid ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : 'border-gray-200 focus:border-primary focus:ring-primary/20'}`} />
        {value && (
          <button onClick={onClear} aria-label={resetLabel} className="rounded-lg border border-gray-200 text-gray-500 p-2 hover:bg-gray-50/60 transition-colors"><RotateCcw className="w-4 h-4" /></button>
        )}
      </div>
    </div>
  )
}

/**
 * Faz C1 — alan bazlı tasarım paneli (Üst/Gövde/Alt). Her alan için yazı ailesi + metin rengi +
 * arka plan rengi global temayı ezer. Sol: kontroller + canlı mini örnek; sağ: tam önizleme iframe.
 * "Uygula" → PATCH theme.areaStyles → iframe yenilenir. Kullanıcı dokunmazsa global tema (varsayılan).
 */
export default function DesignPanel({
  websiteId,
  theme,
  previewLocale,
  onClose,
  onSaved,
}: {
  websiteId: string
  theme: ThemeTokens
  previewLocale: string
  onClose: () => void
  onSaved: (theme: ThemeTokens) => void
}) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const [areas, setAreas] = useState<AreaStyles>(theme.areaStyles ?? {})
  const [active, setActive] = useState<Area>('header')
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose, busy])

  const cur: AreaStyle = areas[active] ?? {}
  const setCur = (patch: Partial<AreaStyle>) => setAreas((p) => ({ ...p, [active]: { ...(p[active] ?? {}), ...patch } }))
  const resetArea = () => setAreas((p) => ({ ...p, [active]: {} }))

  const save = async () => {
    setBusy(true)
    try {
      const cleaned: AreaStyles = {}
      for (const a of AREAS) {
        const s = areas[a]
        if (!s) continue
        // Yalnız geçerli değerleri kaydet — geçersiz hex (#zzz) / preset dışı ölçek / 100 opaklık atlanır.
        const c: AreaStyle = {
          ...(s.fontPairing ? { fontPairing: s.fontPairing } : {}),
          ...(isHex(s.textColor) ? { textColor: s.textColor } : {}),
          ...(isHex(s.bgColor) ? { bgColor: s.bgColor } : {}),
          ...(s.textScale && s.textScale !== '1' && SCALE_VALUES.includes(s.textScale) ? { textScale: s.textScale } : {}),
          ...(isHex(s.accentColor) ? { accentColor: s.accentColor } : {}),
          ...(isHex(s.bgColor) && typeof s.bgOpacity === 'number' && s.bgOpacity >= 0 && s.bgOpacity < 100 ? { bgOpacity: Math.round(s.bgOpacity) } : {}),
        }
        if (c.fontPairing || c.textColor || c.bgColor || c.textScale || c.accentColor || c.bgOpacity != null) cleaned[a] = c
      }
      const newTheme: ThemeTokens = { ...theme, areaStyles: Object.keys(cleaned).length ? cleaned : null }
      const res = await fetch(`/api/website/${websiteId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: newTheme }),
      })
      const json = await res.json()
      if (json.ok && json.website) { onSaved(json.website.theme); setReloadKey((k) => k + 1) }
    } finally { setBusy(false) }
  }

  // Mini canlı örnek için stiller (client; font yüklemesi aşağıdaki <link>'lerden).
  // Fallback'ler gerçek render ile aynı kaynaktan gelir: footer zemini = tema ink'i,
  // header zemini = beyaz, gövde zemini = tema yüzeyi; metin footer'da beyaz, diğerinde ink.
  const themeInk = theme.primaryColor || '#18202B'
  const themeSurface = theme.surfaceColor || '#F1F5F4'
  const pair = cur.fontPairing ? FONT_PAIRINGS[cur.fontPairing] : null
  const sampleBg = isHex(cur.bgColor) ? cur.bgColor : active === 'footer' ? themeInk : active === 'header' ? '#ffffff' : themeSurface
  const sampleInk = isHex(cur.textColor) ? cur.textColor : active === 'footer' ? '#ffffff' : themeInk
  const lowContrast = contrastRatio(sampleBg, sampleInk) < 4.5
  const headingFont = pair?.heading || 'inherit'
  const bodyFont = pair?.body || 'inherit'
  // Faz C2 mini örnek: vurgu rengi + boyut ölçeği + zemin opaklığı (saydam zeminde kart arkası görünür)
  const sampleAccent = isHex(cur.accentColor) ? cur.accentColor : theme.secondaryColor || '#0E7C73'
  const sampleScale = cur.textScale && SCALE_VALUES.includes(cur.textScale) ? Number(cur.textScale) : 1
  const sampleOp = typeof cur.bgOpacity === 'number' ? cur.bgOpacity : 100
  const sampleBgCss = sampleOp < 100 && isHex(cur.bgColor) ? `color-mix(in srgb, ${sampleBg} ${sampleOp}%, transparent)` : sampleBg
  // Faz C2: kullanıcı özel accent seçtiyse buton yazısı (on-accent) ile kontrastı uyar — bazı orta tonlarda ne beyaz ne koyu 4.5:1'e ulaşır.
  const accentLowContrast = isHex(cur.accentColor) && contrastRatio(cur.accentColor, onAccentFor(cur.accentColor)) < 4.5

  const fontLinks = Array.from(new Set(AREAS.map((a) => areaFontHref(areas[a])).filter(Boolean))) as string[]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50 backdrop-blur-md">
      {fontLinks.map((h, k) => <link key={k} rel="stylesheet" href={h} />)}
      <div className="m-3 sm:m-5 flex-1 min-h-0 rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Başlık */}
        <div className="flex items-center justify-between gap-4 px-6 h-16 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Palette className="w-5 h-5 text-primary" /></span>
            <div>
              <h2 className="text-base font-bold text-gray-900">{t('designTitle')}</h2>
              <p className="text-xs text-gray-500">{t('designHint')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white active:scale-[0.97] transition-all disabled:opacity-60">
              <Check className="w-4 h-4" /> {busy ? t('building') : t('designApply')}
            </button>
            <button onClick={() => !busy && onClose()} disabled={busy} aria-label={t('cancel')} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid lg:grid-cols-[380px_1fr]">
          {/* Sol: kontroller */}
          <div className="border-r border-gray-100 overflow-y-auto p-5 space-y-5">
            {/* Alan sekmesi */}
            <div className="inline-flex w-full rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              {AREAS.map((a) => (
                <button key={a} onClick={() => setActive(a)} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active === a ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  {t(`designArea_${a}`)}
                </button>
              ))}
            </div>

            {/* Mini canlı örnek */}
            <div className="rounded-xl ring-1 ring-black/[0.06] overflow-hidden" style={{ backgroundColor: sampleBgCss, color: sampleInk }}>
              <div className="p-5">
                <p className="font-semibold leading-tight" style={{ fontFamily: headingFont, fontSize: `calc(${sampleScale} * 1.35rem)` }}>{t('designSampleHeading')}</p>
                <p className="mt-1.5 opacity-80" style={{ fontFamily: bodyFont, fontSize: `calc(${sampleScale} * 0.9rem)` }}>{t('designSampleBody')}</p>
                <span className="mt-3 inline-flex items-center rounded-full px-4 py-1.5 font-medium" style={{ backgroundColor: sampleAccent, color: onAccentFor(sampleAccent), fontSize: `calc(${sampleScale} * 0.8rem)` }}>{t('designSampleCta')}</span>
              </div>
            </div>

            {lowContrast && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                <p className="text-xs text-primary leading-relaxed">{t('designContrastWarn')}</p>
              </div>
            )}

            {accentLowContrast && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                <p className="text-xs text-primary leading-relaxed">{t('designAccentContrastWarn')}</p>
              </div>
            )}

            {/* Yazı ailesi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('fontLabel')}</label>
              <WizardSelect
                value={cur.fontPairing || ''}
                onChange={(v) => setCur({ fontPairing: v || null })}
                searchable
                searchPlaceholder={t('fontSearch')}
                placeholder={t('designDefault')}
                options={[{ value: '', label: t('designDefault') }, ...FONT_PAIRING_LIST.map((p) => ({ value: p.id, label: p.label }))]}
              />
            </div>

            {/* Yazı boyutu ölçeği */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('designTextScale')}</label>
              <WizardSelect
                value={cur.textScale || '1'}
                onChange={(v) => setCur({ textScale: v })}
                options={[
                  { value: '0.9', label: t('designScale_small') },
                  { value: '1', label: t('designScale_normal') },
                  { value: '1.1', label: t('designScale_large') },
                  { value: '1.25', label: t('designScale_xlarge') },
                ]}
              />
            </div>

            <ColorField label={t('designTextColor')} value={cur.textColor} fallback={sampleInk} placeholder={t('designDefault')} resetLabel={t('designReset')} onChange={(v) => setCur({ textColor: v })} onClear={() => setCur({ textColor: null })} />
            <ColorField label={t('designAccentColor')} value={cur.accentColor} fallback={sampleAccent} placeholder={t('designDefault')} resetLabel={t('designReset')} onChange={(v) => setCur({ accentColor: v })} onClear={() => setCur({ accentColor: null })} />
            <ColorField label={t('designBgColor')} value={cur.bgColor} fallback={sampleBg} placeholder={t('designDefault')} resetLabel={t('designReset')} onChange={(v) => setCur({ bgColor: v })} onClear={() => setCur({ bgColor: null })} />

            {/* Zemin opaklığı */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('designBgOpacity')}</label>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={100} step={5} value={cur.bgOpacity ?? 100} onChange={(e) => setCur({ bgOpacity: Number(e.target.value) })} aria-label={t('designBgOpacity')} className="flex-1 accent-primary cursor-pointer" />
                <span className="text-sm font-mono text-gray-600 w-11 text-right tabular-nums">{cur.bgOpacity ?? 100}%</span>
                {typeof cur.bgOpacity === 'number' && cur.bgOpacity !== 100 && (
                  <button onClick={() => setCur({ bgOpacity: null })} aria-label={t('designReset')} className="rounded-lg border border-gray-200 text-gray-500 p-2 hover:bg-gray-50/60 transition-colors"><RotateCcw className="w-4 h-4" /></button>
                )}
              </div>
              {!isHex(cur.bgColor) && <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">{t('designBgOpacityHint')}</p>}
            </div>

            <button onClick={resetArea} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50/60 transition-colors">
              <RotateCcw className="w-4 h-4" /> {t('designResetArea')}
            </button>
            <p className="text-xs text-gray-400 leading-relaxed">{t('designSaveHint')}</p>
          </div>

          {/* Sağ: tam önizleme (Uygula sonrası güncellenir) */}
          <div className="bg-gray-100 overflow-hidden hidden lg:flex flex-col">
            <div className="flex items-center gap-2 px-4 h-9 border-b border-gray-200 bg-white/60 shrink-0">
              <span className="text-xs text-gray-500">{t('preview')}</span>
              <span className="ml-auto text-xs text-gray-400">{t('designApplyToSeeFull')}</span>
            </div>
            <iframe
              key={reloadKey}
              src={`/website-preview/${websiteId}?locale=${previewLocale}&slug=home`}
              title={t('preview')}
              className="flex-1 w-full border-0 bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
