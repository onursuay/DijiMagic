'use client'

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { SocialPostWithRelations } from '@/lib/social/types'
import PostCard from './PostCard'

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
function sameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b)
}

export default function SocialCalendar({
  monthCursor,
  selectedDate,
  posts,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
  onAddContent,
  onEditPost,
  onCancelPost,
  onRetryPost,
}: {
  monthCursor: Date
  selectedDate: Date
  posts: SocialPostWithRelations[]
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onSelectDate: (d: Date) => void
  onAddContent: (d: Date) => void
  onEditPost: (p: SocialPostWithRelations) => void
  onCancelPost: (p: SocialPostWithRelations) => void
  onRetryPost: (p: SocialPostWithRelations) => void
}) {
  const t = useTranslations('dashboard.sosyalmedya.calendar')
  const locale = useLocale()
  const weekdays = t.raw('weekdays') as string[]
  const months = t.raw('months') as string[]
  const today = new Date()

  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()

  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialPostWithRelations[]>()
    for (const p of posts) {
      const k = dayKey(new Date(p.scheduled_at))
      const arr = map.get(k) ?? []
      arr.push(p)
      map.set(k, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    }
    return map
  }, [posts])

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startWeekday = (firstDay.getDay() + 6) % 7 // Pazartesi = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const out: (Date | null)[] = []
    for (let i = 0; i < startWeekday; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d))
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [year, month])

  const selectedPosts = postsByDay.get(dayKey(selectedDate)) ?? []
  const dayLabel = `${selectedDate.getDate()} ${months[selectedDate.getMonth()]}`

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px]">
      {/* ── Sol: ay ızgarası ── */}
      <div
        className="rounded-2xl border border-gray-200 bg-white p-5 animate-card-enter"
        style={{ ['--card-index' as string]: 0 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {months[month]} {year}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToday}
              className="mr-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              {t('today')}
            </button>
            <button
              type="button"
              onClick={onPrevMonth}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
              aria-label={t('prevMonth')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
              aria-label={t('nextMonth')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1">
          {weekdays.map((w) => (
            <div key={w} className="py-1 text-center text-caption font-medium text-gray-400">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} />
            const dayPosts = postsByDay.get(dayKey(cell)) ?? []
            const isToday = sameDay(cell, today)
            const isSelected = sameDay(cell, selectedDate)
            return (
              <button
                key={dayKey(cell)}
                type="button"
                onClick={() => onSelectDate(cell)}
                className={`flex aspect-square flex-col items-center justify-start rounded-lg border p-1.5 text-left transition-all duration-200 hover:border-primary/40 ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : isToday
                      ? 'border-gray-300 bg-gray-50'
                      : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <span
                  className={`text-sm ${
                    isSelected ? 'font-semibold text-primary' : isToday ? 'font-semibold text-gray-900' : 'text-gray-700'
                  }`}
                >
                  {cell.getDate()}
                </span>
                {dayPosts.length > 0 && (
                  <div className="mt-auto flex w-full flex-wrap items-end gap-0.5">
                    {dayPosts.slice(0, 4).map((p) => (
                      <span
                        key={p.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          p.status === 'published'
                            ? 'bg-emerald-500'
                            : p.status === 'failed'
                              ? 'bg-red-500'
                              : p.status === 'publishing'
                                ? 'bg-primary'
                                : 'bg-gray-300'
                        }`}
                      />
                    ))}
                    {dayPosts.length > 4 && <span className="text-[9px] leading-none text-gray-400">+{dayPosts.length - 4}</span>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Sağ: gün detayı ── */}
      <div
        className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 animate-card-enter"
        style={{ ['--card-index' as string]: 1 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{dayLabel}</h2>
          <span className="text-caption text-gray-400">{t('postCount', { count: selectedPosts.length })}</span>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto">
          {selectedPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 text-center">
              <p className="text-sm text-gray-500">{t('noPostsThisDay')}</p>
            </div>
          ) : (
            selectedPosts.map((p, idx) => (
              <PostCard
                key={p.id}
                post={p}
                index={idx}
                onEdit={onEditPost}
                onCancel={onCancelPost}
                onRetry={onRetryPost}
              />
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => onAddContent(selectedDate)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-all duration-200 hover:bg-primary/10 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          {t('addContent')}
        </button>
      </div>
    </div>
  )
}
