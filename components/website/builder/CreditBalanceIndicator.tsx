'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Sparkles, Infinity as InfinityIcon } from 'lucide-react'
import { useCredits } from '@/components/providers/CreditProvider'

/**
 * #builder-8c — Topbar kredi bakiyesi göstergesi. Mevcut `useCredits` (CreditProvider)
 * üzerinden anlık bakiyeyi gösterir; owner/süper-admin için sınırsız (∞) rozeti.
 * Tıklayınca kredi yükleme sayfasına gider (#krediler). Yeni backend yok — yalnız okuma.
 */
export default function CreditBalanceIndicator() {
  const t = useTranslations('dashboard.webSiteYoneticisi.builder.credit')
  const { credits, loading, isOwner } = useCredits()

  return (
    <Link
      href="/abonelik#krediler"
      title={t('balanceTooltip')}
      aria-label={t('balanceTooltip')}
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 h-9 text-sm font-medium text-primary hover:bg-primary/10 hover:shadow-md transition-all duration-300 active:scale-[0.97]"
    >
      <Sparkles className="w-4 h-4 shrink-0" />
      {isOwner ? (
        <InfinityIcon className="w-4 h-4" aria-label={t('unlimited')} />
      ) : (
        <span className="tabular-nums">{loading ? '—' : credits.toLocaleString('tr-TR')}</span>
      )}
    </Link>
  )
}
