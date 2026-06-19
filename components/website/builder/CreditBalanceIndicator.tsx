'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Sparkles, Infinity as InfinityIcon } from 'lucide-react'
import { useCredits } from '@/components/providers/CreditProvider'

/**
 * #builder-8c / #builder-8d — Topbar kredi bakiyesi pill'i. Mevcut `useCredits`
 * (CreditProvider) üzerinden anlık bakiyeyi gösterir; owner/süper-admin için sınırsız (∞).
 * Tıklayınca kredi yükleme sayfasına gider (#krediler). Yeni backend yok — yalnız okuma.
 *
 * #builder-8d: sade, sessiz pill — yalnız küçük spark ikonu + sayı (eski çubuk faz-timeline
 * DEĞİL). Quiet chrome ile uyumlu, primary yalnız aksan.
 */
export default function CreditBalanceIndicator() {
  const t = useTranslations('dashboard.webSiteYoneticisi.builder.credit')
  const { credits, loading, isOwner } = useCredits()

  return (
    <Link
      href="/abonelik#krediler"
      title={t('balanceTooltip')}
      aria-label={t('balanceTooltip')}
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 h-8 text-sm font-medium text-gray-700 hover:border-primary/30 hover:bg-primary/[0.04] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors active:scale-[0.97]"
    >
      <Sparkles className="w-3.5 h-3.5 shrink-0 text-primary" />
      {isOwner ? (
        <InfinityIcon className="w-3.5 h-3.5 text-primary" aria-label={t('unlimited')} />
      ) : (
        <span className="tabular-nums">{loading ? '—' : credits.toLocaleString('tr-TR')}</span>
      )}
    </Link>
  )
}
