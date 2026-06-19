'use client'

import { useTranslations } from 'next-intl'
import { FileText } from 'lucide-react'
import type { WebsitePage } from '@/lib/website/types'

const PAGE_LABELS: Record<string, Record<string, string>> = {
  tr: { home: 'Ana Sayfa', about: 'Hakkımızda', services: 'Hizmetler', contact: 'İletişim' },
  en: { home: 'Home', about: 'About', services: 'Services', contact: 'Contact' },
  de: { home: 'Startseite', about: 'Über uns', services: 'Leistungen', contact: 'Kontakt' },
  fr: { home: 'Accueil', about: 'À propos', services: 'Services', contact: 'Contact' },
  es: { home: 'Inicio', about: 'Nosotros', services: 'Servicios', contact: 'Contacto' },
}

export function pageLabelFor(page: WebsitePage, previewLocale: string): string {
  const m = PAGE_LABELS[previewLocale] ?? PAGE_LABELS.en
  return m[page.pageRole] ?? page.slug
}

interface PageNavigatorProps {
  pages: WebsitePage[]
  previewLocale: string
  activeSlug: string
  onSelect: (slug: string) => void
}

/**
 * #builder-8a — Sayfa gezgini: sitenin sayfalarını listeler; tıklayınca tuvalin sayfası değişir
 * (BuilderWorkspace activeSlug'ı günceller → PreviewCanvas iframe slug'ı yenilenir).
 */
export default function PageNavigator({ pages, previewLocale, activeSlug, onSelect }: PageNavigatorProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  if (pages.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-base font-medium text-gray-700 px-1">{t('builder.pagesTitle')}</h3>
      <ul className="space-y-1">
        {pages.map((p) => {
          const active = p.slug === activeSlug
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.slug)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left ${
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-gray-600 hover:bg-gray-50/60'
                }`}
              >
                <FileText className={`w-4 h-4 shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`} />
                <span className="truncate">{pageLabelFor(p, previewLocale)}</span>
                <span className="ml-auto text-caption text-gray-400 truncate">/{p.slug === 'home' ? '' : p.slug}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
