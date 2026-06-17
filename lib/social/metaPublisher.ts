/**
 * Sosyal Medya Yönetimi — user-id parametreli Meta yayıncısı.
 *
 * Mevcut interaktif publish route'ları (app/api/meta/publish/*) cookie'den token
 * okur → cron worker'da çalışmaz. Bu modül AYNI Graph API akışını DB'deki
 * (user_id → access_token) bağlantıdan okuyarak uygular. Mevcut route'lara
 * dokunulmaz (Meta publish koruması); bu paralel bir kopyadır.
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
 * Supabase Storage host'umuzdan ve https olabilir. Bu hem sunucunun fetch ettiği
 * (FB Reels) hem Meta'ya image_url/video_url olarak gönderilen URL'i kapsar; keyfi
 * bir URL DB'ye sızsa bile internal/loopback/3rd-party hedefe istek gitmez.
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

export interface PublishTargetArgs {
  platform: SocialPlatform
  pageId: string
  igUserId?: string | null
  format: SocialFormat
  mediaUrl: string
  mediaType: SocialMediaType
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

/** user_id → geçerli Meta user access token (DB'den, decrypt edilmiş). */
async function resolveUserToken(userId: string): Promise<string | null> {
  const conn = await getMetaConnection(userId)
  return conn?.accessToken ?? null
}

export async function publishToTarget(userId: string, args: PublishTargetArgs): Promise<PublishResult> {
  const { platform, pageId, igUserId, format, mediaUrl, mediaType, caption } = args

  // Format ↔ medya doğrulaması
  if (format === 'reels' && mediaType === 'image') return fail('Reels yalnızca video destekler')
  if (platform === 'facebook' && format === 'story') return fail('Facebook Hikaye desteklenmiyor')
  if (platform === 'instagram' && !igUserId) return fail('Instagram hesabı çözümlenemedi')
  // SSRF koruması: medya yalnız kendi Storage host'umuzdan olabilir.
  if (!isAllowedMediaUrl(mediaUrl)) return fail('Geçersiz medya kaynağı')

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
    return publishInstagram(pageToken, igUserId!, format, mediaUrl, mediaType, caption)
  }
  return publishFacebook(pageToken, pageId, format, mediaUrl, mediaType, caption)
}

/* --------------------------- Instagram --------------------------- */

async function publishInstagram(
  pageToken: string,
  igUserId: string,
  format: SocialFormat,
  mediaUrl: string,
  mediaType: SocialMediaType,
  caption?: string | null,
): Promise<PublishResult> {
  const client = new MetaGraphClient({ accessToken: pageToken, timeout: 30000 })

  // Step 1: container
  const containerParams = new URLSearchParams()
  if (caption && format !== 'story') containerParams.append('caption', caption)
  if (mediaType === 'image') containerParams.append('image_url', mediaUrl)
  else containerParams.append('video_url', mediaUrl)
  if (format === 'reels') containerParams.append('media_type', 'REELS')
  else if (format === 'story') containerParams.append('media_type', 'STORIES')

  const containerResult = await client.postForm(`/${igUserId}/media`, containerParams)
  if (!containerResult.ok) return fail(containerResult.error?.message || 'Instagram medya container hatası')
  const containerId = containerResult.data?.id
  if (!containerId) return fail('Instagram container ID alınamadı')

  // Step 2: poll
  const pollDelay = mediaType === 'image' && format === 'feed' ? 2000 : POLL_INTERVAL_MS
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, pollDelay))
    const statusResult = await client.get(`/${containerId}`, { fields: 'status_code' })
    if (statusResult.ok) {
      const statusCode = statusResult.data?.status_code
      if (statusCode === 'FINISHED') break
      if (statusCode === 'ERROR') return fail('Instagram medya işleme hatası')
    }
    if (i === MAX_POLLS - 1) return fail('Instagram medya işleme zaman aşımı')
  }

  // Step 3: publish
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
  mediaUrl: string,
  mediaType: SocialMediaType,
  caption?: string | null,
): Promise<PublishResult> {
  const client = new MetaGraphClient({ accessToken: pageToken, timeout: 60000 })

  if (format === 'reels') {
    return publishFacebookReels(client, pageId, pageToken, mediaUrl, caption)
  }

  // Feed
  if (mediaType === 'image') {
    const params = new URLSearchParams()
    params.append('url', mediaUrl)
    if (caption) params.append('message', caption)
    const result = await client.postForm(`/${pageId}/photos`, params)
    if (!result.ok) return fail(result.error?.message || 'Görsel yayınlanamadı')
    return { ok: true, publishedId: result.data?.id || result.data?.post_id }
  }
  const params = new URLSearchParams()
  params.append('file_url', mediaUrl)
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
