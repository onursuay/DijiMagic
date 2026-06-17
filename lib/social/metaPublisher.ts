/**
 * Sosyal Medya Yönetimi — user-id parametreli Meta yayıncısı.
 *
 * Mevcut interaktif publish route'ları (app/api/meta/publish/*) cookie'den token
 * okur → cron worker'da çalışmaz. Bu modül AYNI Graph API akışını DB'deki
 * (user_id → access_token) bağlantıdan okuyarak uygular. Mevcut route'lara
 * dokunulmaz (Meta publish koruması); bu paralel bir kopyadır.
 *
 * Tekil ve carousel (çoklu medya, yalnız feed) yayını destekler.
 */
import 'server-only'
import { getMetaConnection } from '@/lib/metaConnectionStore'
import { getPageAccessToken } from '@/lib/meta/pageToken'
import { MetaGraphClient } from '@/lib/meta/client'
import { META_GRAPH_VERSION } from '@/lib/metaConfig'
import { resolveSupabaseUrl } from '@/lib/supabase/env'
import type { SocialFormat, SocialMediaType, SocialPlatform } from './types'

/**
 * SSRF koruması (derinlemesine savunma): yayınlanacak medya URL'i yalnız kendi
 * Supabase Storage host'umuzdan ve https olabilir.
 */
let allowedMediaHost = ''
try { allowedMediaHost = new URL(resolveSupabaseUrl() || '').host } catch { /* env yok */ }

function isAllowedMediaUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !!allowedMediaHost && u.host === allowedMediaHost
  } catch {
    return false
  }
}

export interface PublishMediaItem {
  url: string
  type: SocialMediaType
}

export interface PublishTargetArgs {
  platform: SocialPlatform
  pageId: string
  igUserId?: string | null
  format: SocialFormat
  media: PublishMediaItem[]
  caption?: string | null
}

export interface PublishResult {
  ok: boolean
  publishedId?: string
  error?: string
}

const POLL_INTERVAL_MS = 5000
const MAX_POLLS = 12 // 60s

function fail(error: string): PublishResult {
  return { ok: false, error }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function resolveUserToken(userId: string): Promise<string | null> {
  const conn = await getMetaConnection(userId)
  return conn?.accessToken ?? null
}

export async function publishToTarget(userId: string, args: PublishTargetArgs): Promise<PublishResult> {
  const { platform, pageId, igUserId, format, caption } = args

  // Carousel yalnız feed'de; diğer biçimler tek medya kullanır.
  const media = format === 'feed' ? args.media : args.media.slice(0, 1)
  if (media.length === 0) return fail('Medya bulunamadı')

  const primary = media[0]
  if (format === 'reels' && primary.type === 'image') return fail('Reels yalnızca video destekler')
  if (platform === 'facebook' && format === 'story') return fail('Facebook Hikaye desteklenmiyor')
  if (platform === 'instagram' && !igUserId) return fail('Instagram hesabı çözümlenemedi')
  for (const m of media) {
    if (!isAllowedMediaUrl(m.url)) return fail('Geçersiz medya kaynağı')
  }

  const userToken = await resolveUserToken(userId)
  if (!userToken) return fail('Meta bağlantısı bulunamadı veya süresi dolmuş')

  let pageToken: string
  try {
    const tokenResult = await getPageAccessToken(userToken, pageId)
    pageToken = tokenResult.pageToken
  } catch (err: any) {
    return fail(err?.message || 'Sayfa token\'ı alınamadı')
  }

  if (platform === 'instagram') {
    return publishInstagram(pageToken, igUserId!, format, media, caption)
  }
  return publishFacebook(pageToken, pageId, format, media, caption)
}

/* --------------------------- Instagram --------------------------- */

/** Container hazır olana dek bekler (özellikle video). */
async function pollContainer(client: MetaGraphClient, containerId: string, type: SocialMediaType): Promise<PublishResult> {
  const delay = type === 'image' ? 2000 : POLL_INTERVAL_MS
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(delay)
    const statusResult = await client.get(`/${containerId}`, { fields: 'status_code' })
    if (statusResult.ok) {
      const statusCode = statusResult.data?.status_code
      if (statusCode === 'FINISHED') return { ok: true }
      if (statusCode === 'ERROR') return fail('Instagram medya işleme hatası')
    }
    if (i === MAX_POLLS - 1) return fail('Instagram medya işleme zaman aşımı')
  }
  return { ok: true }
}

async function publishInstagram(
  pageToken: string,
  igUserId: string,
  format: SocialFormat,
  media: PublishMediaItem[],
  caption?: string | null,
): Promise<PublishResult> {
  const client = new MetaGraphClient({ accessToken: pageToken, timeout: 30000 })

  // ── Carousel (feed, çoklu medya) ──
  if (format === 'feed' && media.length > 1) {
    const childIds: string[] = []
    for (const m of media) {
      const params = new URLSearchParams()
      if (m.type === 'image') {
        params.append('image_url', m.url)
      } else {
        params.append('video_url', m.url)
        params.append('media_type', 'VIDEO') // carousel video öğesi için zorunlu (Graph v24)
      }
      params.append('is_carousel_item', 'true')
      const r = await client.postForm(`/${igUserId}/media`, params)
      if (!r.ok || !r.data?.id) return fail(r.error?.message || 'Instagram carousel öğesi oluşturulamadı')
      const ready = await pollContainer(client, r.data.id, m.type)
      if (!ready.ok) return ready
      childIds.push(r.data.id)
    }
    const carouselParams = new URLSearchParams()
    carouselParams.append('media_type', 'CAROUSEL')
    carouselParams.append('children', childIds.join(','))
    if (caption) carouselParams.append('caption', caption)
    const cr = await client.postForm(`/${igUserId}/media`, carouselParams)
    if (!cr.ok || !cr.data?.id) return fail(cr.error?.message || 'Instagram carousel oluşturulamadı')
    const ready = await pollContainer(client, cr.data.id, 'image')
    if (!ready.ok) return ready
    const publishParams = new URLSearchParams()
    publishParams.append('creation_id', cr.data.id)
    const pub = await client.postForm(`/${igUserId}/media_publish`, publishParams)
    if (!pub.ok) return fail(pub.error?.message || 'Instagram yayınlama başarısız')
    return { ok: true, publishedId: pub.data?.id }
  }

  // ── Tekil (feed/reels/story) ──
  const m = media[0]
  const containerParams = new URLSearchParams()
  if (caption && format !== 'story') containerParams.append('caption', caption)
  if (m.type === 'image') containerParams.append('image_url', m.url)
  else containerParams.append('video_url', m.url)
  if (format === 'reels') containerParams.append('media_type', 'REELS')
  else if (format === 'story') containerParams.append('media_type', 'STORIES')
  else if (m.type === 'video') containerParams.append('media_type', 'VIDEO') // feed video için zorunlu (Graph v24)

  const containerResult = await client.postForm(`/${igUserId}/media`, containerParams)
  if (!containerResult.ok) return fail(containerResult.error?.message || 'Instagram medya container hatası')
  const containerId = containerResult.data?.id
  if (!containerId) return fail('Instagram container ID alınamadı')

  const ready = await pollContainer(client, containerId, format === 'feed' ? m.type : 'video')
  if (!ready.ok) return ready

  const publishParams = new URLSearchParams()
  publishParams.append('creation_id', containerId)
  const publishResult = await client.postForm(`/${igUserId}/media_publish`, publishParams)
  if (!publishResult.ok) return fail(publishResult.error?.message || 'Instagram yayınlama başarısız')
  return { ok: true, publishedId: publishResult.data?.id }
}

/* --------------------------- Facebook ---------------------------- */

async function publishFacebook(
  pageToken: string,
  pageId: string,
  format: SocialFormat,
  media: PublishMediaItem[],
  caption?: string | null,
): Promise<PublishResult> {
  const client = new MetaGraphClient({ accessToken: pageToken, timeout: 60000 })

  if (format === 'reels') {
    return publishFacebookReels(client, pageId, pageToken, media[0].url, caption)
  }

  // ── Çoklu görsel (feed) → tek gönderide birden çok foto ──
  const allImages = media.every((m) => m.type === 'image')
  if (media.length > 1 && allImages) {
    const fbids: string[] = []
    for (const m of media) {
      const params = new URLSearchParams()
      params.append('url', m.url)
      params.append('published', 'false')
      const r = await client.postForm(`/${pageId}/photos`, params)
      if (!r.ok || !r.data?.id) return fail(r.error?.message || 'Facebook fotoğrafı yüklenemedi')
      fbids.push(r.data.id)
    }
    const feedParams = new URLSearchParams()
    if (caption) feedParams.append('message', caption)
    fbids.forEach((id, i) => feedParams.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })))
    const fr = await client.postForm(`/${pageId}/feed`, feedParams)
    if (!fr.ok) return fail(fr.error?.message || 'Facebook gönderisi oluşturulamadı')
    return { ok: true, publishedId: fr.data?.id }
  }

  // ── Tekil görsel/video (feed) ──
  const m = media[0]
  if (m.type === 'image') {
    const params = new URLSearchParams()
    params.append('url', m.url)
    if (caption) params.append('message', caption)
    const result = await client.postForm(`/${pageId}/photos`, params)
    if (!result.ok) return fail(result.error?.message || 'Görsel yayınlanamadı')
    return { ok: true, publishedId: result.data?.id || result.data?.post_id }
  }
  const params = new URLSearchParams()
  params.append('file_url', m.url)
  if (caption) params.append('description', caption)
  const result = await client.postForm(`/${pageId}/videos`, params)
  if (!result.ok) return fail(result.error?.message || 'Video yayınlanamadı')
  return { ok: true, publishedId: result.data?.id }
}

async function publishFacebookReels(
  client: MetaGraphClient,
  pageId: string,
  pageToken: string,
  videoUrl: string,
  caption?: string | null,
): Promise<PublishResult> {
  // Phase 1: start
  const startParams = new URLSearchParams()
  startParams.append('upload_phase', 'start')
  const startResult = await client.postForm(`/${pageId}/video_reels`, startParams)
  if (!startResult.ok || !startResult.data?.video_id) return fail(startResult.error?.message || 'Reels başlatılamadı')
  const videoId = startResult.data.video_id

  // Phase 2: download + binary upload
  let videoBuffer: ArrayBuffer
  try {
    const videoRes = await fetch(videoUrl, { signal: AbortSignal.timeout(30000) })
    if (!videoRes.ok) throw new Error(`Video indirilemedi: ${videoRes.status}`)
    videoBuffer = await videoRes.arrayBuffer()
  } catch (err: any) {
    return fail(err?.message || 'Video indirilemedi')
  }
  const uploadUrl = `https://rupload.facebook.com/video-upload/${META_GRAPH_VERSION}/${videoId}`
  try {
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${pageToken}`,
        offset: '0',
        file_size: videoBuffer.byteLength.toString(),
        'Content-Type': 'application/octet-stream',
      },
      body: videoBuffer,
      signal: AbortSignal.timeout(60000),
    })
    if (!uploadRes.ok) return fail('Reels video yüklenemedi')
  } catch (err: any) {
    return fail(err?.message || 'Video upload hatası')
  }

  // Phase 3: finish
  const finishParams = new URLSearchParams()
  finishParams.append('upload_phase', 'finish')
  finishParams.append('video_id', videoId)
  if (caption) finishParams.append('description', caption)
  const finishResult = await client.postForm(`/${pageId}/video_reels`, finishParams)
  if (!finishResult.ok) return fail(finishResult.error?.message || 'Reels yayınlanamadı')
  return { ok: true, publishedId: finishResult.data?.id || videoId }
}
