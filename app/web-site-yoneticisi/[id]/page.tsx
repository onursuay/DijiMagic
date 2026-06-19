'use client'

import { useParams } from 'next/navigation'
import BuilderWorkspace from '@/components/website/builder/BuilderWorkspace'

/**
 * #builder-8a — Site detayı artık tam-ekran Builder Workspace'tir (Promake tarzı).
 * Eski dashboard-içi dar iframe + ayrı /onizleme sayfası KALDIRILDI; düzenleme, BÜYÜK
 * önizleme tuvali, revize ve yayınlama tek workspace iskeletinde toplanır.
 *
 * `app/tasarim` split-pane istisnası geçerli (max-w-7xl uygulanmaz); workspace, modül
 * layout'unun `flex-1 flex flex-col overflow-hidden` konteynerini tamamen doldurur.
 */
export default function WebSiteDetailPage() {
  const params = useParams()
  const id = String(params?.id ?? '')
  return <BuilderWorkspace websiteId={id} />
}
