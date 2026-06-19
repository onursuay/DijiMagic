'use client'

import { useTranslations } from 'next-intl'
import type { WebsitePage } from '@/lib/website/types'
import { pageLabelFor } from './PageNavigator'

const LOCALE_NAMES: Record<string, string> = {
  tr: 'Türkçe', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', ar: 'العربية', it: 'Italiano', ru: 'Русский',
}
const localeName = (l: string) => LOCALE_NAMES[l] ?? l.toUpperCase()

interface PageTabsStripProps {
  pages: WebsitePage[]
  previewLocale: string
  activeSlug: string
  onSelect: (slug: string) => void
  /** Çok-dilli sitelerde dil seçici (tek dil ise gizli). */
  locales: string[]
  onLocaleChange: (loc: string) => void
}

/**
 * #builder-8d — Topbar altında ince ikincil şerit (≈40px): sitenin sayfalarını yatay kompakt
 * SEKMELER olarak gösterir (Ana Sayfa · İletişim · Hizmetler). Aktif sekme emerald alt-çizgi +
 * hafif primary zemin alır. Sol-rail "Sayfalar" bloğunu DEĞİŞTİRİR; çok sayfada yatay scroll.
 * Çok-dilli sitede sağ uçta sade dil seçici durur. Tüm metinler i18n; amber/sarı YASAK.
 */
export default function PageTabsStrip({
  pages,
  previewLocale,
  activeSlug,
  onSelect,
  locales,
  onLocaleChange,
}: PageTabsStripProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  if (pages.length === 0) return null

  return (
    <div className="shrink-0 flex items-center gap-3 border-b border-gray-200/80 bg-white/70 backdrop-blur-sm px-4 h-10">
      <nav
        aria-label={t('builder.pagesTitle')}
        className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto wsy-tabs-scroll"
      >
        {pages.map((p) => {
          const active = p.slug === activeSlug
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.slug)}
              aria-current={active ? 'page' : undefined}
              className={`relative shrink-0 inline-flex items-center rounded-md px-3 h-7 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                active
                  ? 'text-primary font-medium bg-primary/[0.06]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/80'
              }`}
            >
              <span className="truncate max-w-[10rem]">{pageLabelFor(p, previewLocale)}</span>
              {active && (
                <span
                  className="pointer-events-none absolute inset-x-2.5 -bottom-[5px] h-0.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </nav>

      {locales.length > 1 && (
        <div className="shrink-0 inline-flex items-center rounded-lg border border-gray-200 p-0.5 bg-white">
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => onLocaleChange(loc)}
              aria-pressed={previewLocale === loc}
              className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors ${
                previewLocale === loc ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {localeName(loc)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
