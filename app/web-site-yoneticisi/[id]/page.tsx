'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import type { Website } from '@/lib/website/types'

export default function WebSiteDetailPage() {
  const params = useParams()
  const id = String(params?.id ?? '')
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const [site, setSite] = useState<Website | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/website/${id}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setSite(j.website) })
      .catch(() => {})
  }, [id])

  return (
    <>
      <Topbar title={site?.label ?? t('title')} description={site?.subdomain ?? ''} />
      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Faz 1c: yönlendirilmiş intake diyaloğu + önizleme + yayın buraya gelecek */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 animate-card-enter">
            <p className="text-sm leading-relaxed text-gray-600">
              {site ? `${site.label} — ${t(
                site.status === 'published'
                  ? 'statusPublished'
                  : site.status === 'unpublished'
                  ? 'statusUnpublished'
                  : 'statusDraft',
              )}` : '…'}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
