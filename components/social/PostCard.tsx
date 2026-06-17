'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Instagram, Facebook, Pencil, Trash2, RotateCcw, Play } from 'lucide-react'
import type { SocialPostWithRelations } from '@/lib/social/types'
import PostStatusBadge from './PostStatusBadge'

export default function PostCard({
  post,
  index = 0,
  onEdit,
  onCancel,
  onRetry,
}: {
  post: SocialPostWithRelations
  index?: number
  onEdit: (post: SocialPostWithRelations) => void
  onCancel: (post: SocialPostWithRelations) => void
  onRetry: (post: SocialPostWithRelations) => void
}) {
  const t = useTranslations('dashboard.sosyalmedya.post')
  const locale = useLocale()
  const media = post.media[0]
  const editable = post.status === 'scheduled' || post.status === 'draft' || post.status === 'failed'

  const time = new Date(post.scheduled_at).toLocaleTimeString(locale === 'en' ? 'en-US' : 'tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: post.timezone || 'Europe/Istanbul',
  })

  const igCount = post.targets.filter((x) => x.platform === 'instagram').length
  const fbCount = post.targets.filter((x) => x.platform === 'facebook').length

  return (
    <div
      className="group flex gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-all duration-300 hover:shadow-md animate-card-enter"
      style={{ ['--card-index' as string]: Math.min(index, 10) }}
    >
      {/* Önizleme */}
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {media ? (
          media.media_type === 'video' ? (
            <>
              <video src={media.public_url} className="h-full w-full object-cover" muted preload="metadata" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Play className="h-5 w-5 fill-white text-white" />
              </span>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.public_url} alt="" className="h-full w-full object-cover" />
          )
        ) : null}
      </div>

      {/* Gövde */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-900">{time}</span>
          <PostStatusBadge status={post.status} />
        </div>

        {post.caption ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-600">{post.caption}</p>
        ) : null}

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-gray-400">
            {igCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs">
                <Instagram className="h-3.5 w-3.5" />
                {igCount}
              </span>
            )}
            {fbCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs">
                <Facebook className="h-3.5 w-3.5" />
                {fbCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {post.status === 'failed' && (
              <button
                type="button"
                onClick={() => onRetry(post)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('retry')}
              </button>
            )}
            {editable && (
              <button
                type="button"
                onClick={() => onEdit(post)}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label={t('edit')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {editable && (
              <button
                type="button"
                onClick={() => onCancel(post)}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label={t('cancel')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {post.status === 'failed' && post.last_error && (
          <p className="mt-1.5 line-clamp-1 text-xs text-red-600">{post.last_error}</p>
        )}
      </div>
    </div>
  )
}
