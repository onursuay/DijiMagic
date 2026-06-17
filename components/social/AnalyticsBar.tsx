'use client'

import { useTranslations } from 'next-intl'
import { BarChart3, Heart, MessageCircle, Clock } from 'lucide-react'
import type { AnalyticsSummary } from '@/lib/social/insights'

export default function AnalyticsBar({ summary }: { summary: AnalyticsSummary }) {
  const t = useTranslations('dashboard.sosyalmedya.analytics')

  const metrics = [
    { Icon: BarChart3, label: t('published'), value: String(summary.publishedCount) },
    { Icon: Heart, label: t('likes'), value: String(summary.totalLikes) },
    { Icon: MessageCircle, label: t('comments'), value: String(summary.totalComments) },
    {
      Icon: Clock,
      label: t('bestHour'),
      value: summary.bestHour != null ? t('bestHourValue', { hour: summary.bestHour }) : t('notEnoughData'),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className="rounded-xl border border-gray-200 bg-white p-3.5 animate-card-enter"
          style={{ ['--card-index' as string]: i }}
        >
          <div className="flex items-center gap-1.5 text-gray-400">
            <m.Icon className="h-3.5 w-3.5" />
            <span className="text-caption font-medium">{m.label}</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-gray-900">{m.value}</p>
        </div>
      ))}
    </div>
  )
}
