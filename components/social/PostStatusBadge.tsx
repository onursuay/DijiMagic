'use client'

import { useTranslations } from 'next-intl'
import { Clock, Loader2, CheckCircle2, AlertCircle, FileEdit } from 'lucide-react'
import type { SocialPostStatus } from '@/lib/social/types'

/**
 * Gönderi durum rozeti. Renk kuralı: amber/sarı YOK.
 * scheduled→gri, publishing→primary, published→emerald, failed→red, draft/cancelled→gri.
 */
export default function PostStatusBadge({ status }: { status: SocialPostStatus }) {
  const t = useTranslations('dashboard.sosyalmedya.status')

  const config: Record<SocialPostStatus, { cls: string; Icon: typeof Clock; spin?: boolean }> = {
    draft: { cls: 'bg-gray-100 text-gray-600', Icon: FileEdit },
    scheduled: { cls: 'bg-gray-100 text-gray-700', Icon: Clock },
    publishing: { cls: 'bg-primary/10 text-primary', Icon: Loader2, spin: true },
    published: { cls: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
    partial: { cls: 'bg-primary/10 text-primary', Icon: AlertCircle },
    failed: { cls: 'bg-red-50 text-red-700', Icon: AlertCircle },
    cancelled: { cls: 'bg-gray-100 text-gray-500', Icon: AlertCircle },
  }

  const { cls, Icon, spin } = config[status]

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium ${cls}`}>
      <Icon className={`h-3 w-3 ${spin ? 'animate-spin' : ''}`} />
      {t(status)}
    </span>
  )
}
