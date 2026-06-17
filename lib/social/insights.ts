/**
 * Sosyal Medya — yayınlanan içeriklerin Meta etkileşim metrikleri + optimal saat.
 *
 * Hafif yaklaşım: insights API yerine medya/post node'undan like/comment sayıları
 * okunur (tek çağrı, rate-limit dostu). Token DB'deki bağlantıdan (user_id) çözülür.
 */
import 'server-only'
import { getMetaConnection } from '@/lib/metaConnectionStore'
import { getPageAccessToken } from '@/lib/meta/pageToken'
import { MetaGraphClient } from '@/lib/meta/client'
import type { SocialPostWithRelations } from './types'

export interface PostEngagement {
  postId: string
  likes: number
  comments: number
  total: number
}

export interface AnalyticsSummary {
  publishedCount: number
  totalLikes: number
  totalComments: number
  totalEngagement: number
  /** En yüksek ortalama etkileşimli yayın saati (0-23); yeterli veri yoksa null. */
  bestHour: number | null
  perPost: PostEngagement[]
}

async function igMediaStats(client: MetaGraphClient, mediaId: string): Promise<{ likes: number; comments: number }> {
  const r = await client.get(`/${mediaId}`, { fields: 'like_count,comments_count' })
  if (!r.ok) return { likes: 0, comments: 0 }
  return { likes: Number(r.data?.like_count) || 0, comments: Number(r.data?.comments_count) || 0 }
}

async function fbPostStats(client: MetaGraphClient, postId: string): Promise<{ likes: number; comments: number }> {
  const r = await client.get(`/${postId}`, { fields: 'likes.summary(true),comments.summary(true)' })
  if (!r.ok) return { likes: 0, comments: 0 }
  return {
    likes: Number(r.data?.likes?.summary?.total_count) || 0,
    comments: Number(r.data?.comments?.summary?.total_count) || 0,
  }
}

/**
 * Yayınlanan postların etkileşimini çeker ve özetler. published_id olmayan
 * hedefler atlanır; Meta bağlantısı yoksa boş özet döner.
 */
export async function buildAnalytics(userId: string, posts: SocialPostWithRelations[]): Promise<AnalyticsSummary> {
  const published = posts.filter((p) => p.status === 'published')
  const empty: AnalyticsSummary = {
    publishedCount: published.length,
    totalLikes: 0,
    totalComments: 0,
    totalEngagement: 0,
    bestHour: null,
    perPost: [],
  }
  if (published.length === 0) return empty

  const conn = await getMetaConnection(userId)
  if (!conn?.accessToken) return empty
  const userToken = conn.accessToken

  const pageTokenCache = new Map<string, string | null>()
  const getToken = async (pageId: string): Promise<string | null> => {
    if (pageTokenCache.has(pageId)) return pageTokenCache.get(pageId)!
    try {
      const { pageToken } = await getPageAccessToken(userToken, pageId)
      pageTokenCache.set(pageId, pageToken)
      return pageToken
    } catch {
      pageTokenCache.set(pageId, null)
      return null
    }
  }

  const perPost: PostEngagement[] = []
  let totalLikes = 0
  let totalComments = 0
  // saat -> { sum, count } (ortalama etkileşim için)
  const hourBuckets = new Map<number, { sum: number; count: number }>()

  for (const post of published) {
    let likes = 0
    let comments = 0
    for (const target of post.targets) {
      if (target.target_status !== 'published' || !target.published_id) continue
      const pageToken = await getToken(target.page_id)
      if (!pageToken) continue
      const client = new MetaGraphClient({ accessToken: pageToken, timeout: 15000 })
      const stats = target.platform === 'instagram'
        ? await igMediaStats(client, target.published_id)
        : await fbPostStats(client, target.published_id)
      likes += stats.likes
      comments += stats.comments
    }
    const total = likes + comments
    perPost.push({ postId: post.id, likes, comments, total })
    totalLikes += likes
    totalComments += comments

    const hour = new Date(post.scheduled_at).getHours()
    const b = hourBuckets.get(hour) ?? { sum: 0, count: 0 }
    b.sum += total
    b.count += 1
    hourBuckets.set(hour, b)
  }

  // Optimal saat: en az 3 yayın varsa, en yüksek ortalama etkileşimli saat.
  let bestHour: number | null = null
  if (published.length >= 3) {
    let bestAvg = -1
    for (const [hour, b] of hourBuckets) {
      const avg = b.sum / b.count
      if (avg > bestAvg) { bestAvg = avg; bestHour = hour }
    }
  }

  return {
    publishedCount: published.length,
    totalLikes,
    totalComments,
    totalEngagement: totalLikes + totalComments,
    bestHour,
    perPost,
  }
}
