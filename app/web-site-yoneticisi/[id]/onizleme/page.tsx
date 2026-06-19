'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

/**
 * #builder-8a — Eski ayrı "Detaylı Önizle" sayfası, tam-ekran Builder Workspace'e konsolide edildi.
 * Bu route geriye dönük uyumluluk için workspace'e (site detayı) yönlendirir; revize/önizleme/yayınla
 * akışları artık orada. Eski sıkışık önizleme düzeni kullanılmaz.
 */
export default function WebsiteReviewRedirect() {
  const params = useParams()
  const router = useRouter()
  const id = String(params?.id ?? '')

  useEffect(() => {
    if (id) router.replace(`/web-site-yoneticisi/${id}`)
  }, [id, router])

  return null
}
