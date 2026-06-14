'use client'

import { useTranslations } from 'next-intl'
import { Globe, Trash2 } from 'lucide-react'
import type { Website } from '@/lib/website/types'

interface SiteListProps {
  sites: Website[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

export default function SiteList({ sites, onOpen, onDelete }: SiteListProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')

  const statusLabel = (s: Website['status']) =>
    s === 'published' ? t('statusPublished') : s === 'unpublished' ? t('statusUnpublished') : t('statusDraft')

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sites.map((site, index) => (
        <div
          key={site.id}
          className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 animate-card-enter hover:shadow-md transition-all duration-300"
          style={{ ['--card-index' as string]: Math.min(index, 10) }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900 truncate">{site.label}</h3>
              <p className="text-sm text-gray-500 truncate">{site.subdomain}</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5">
            {statusLabel(site.status)}
          </span>
          <div className="mt-auto flex items-center gap-2">
            <button
              onClick={() => onOpen(site.id)}
              className="flex-1 rounded-lg bg-primary text-white text-sm font-medium py-2 active:scale-[0.97] transition-all"
            >
              {t('open')}
            </button>
            <button
              onClick={() => onDelete(site.id)}
              aria-label={t('delete')}
              className="rounded-lg border border-gray-200 text-gray-500 p-2 hover:bg-gray-50/60 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
