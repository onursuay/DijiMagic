/**
 * Sosyal Medya — AI medya üretimi + kalıcılaştırma.
 *
 * Tasarım modülünün fal.ai motorunu yeniden kullanır (görsel: seedream/flux —
 * lib/seo/imageForArticle; video: kling). Üretilen fal CDN çıktısı social-media
 * bucket'a kopyalanır; SSRF koruması ve takvim akışı yalnız kendi storagePath'imizi
 * kabul ettiği için bu köprü zorunludur.
 */
import 'server-only'
import { fal } from '@fal-ai/client'
import { randomUUID } from 'node:crypto'
import { generateImage } from '@/lib/seo/imageForArticle'
import { supabase } from '@/lib/supabase/client'
import type { SocialMediaType } from './types'

const BUCKET = 'social-media'

let configured = false
function ensureFal() {
  if (!configured) {
    fal.config({ credentials: process.env.FAL_KEY! })
    configured = true
  }
}

export type AiMediaKind = SocialMediaType // 'image' | 'video'

export interface GenerateMediaInput {
  kind: AiMediaKind
  prompt: string
  aspectRatio?: string // '1:1' | '9:16' | '16:9' | '4:3'
}

export interface GeneratedMedia {
  storagePath: string
  publicUrl: string
  mediaType: SocialMediaType
  width?: number
  height?: number
}

async function generateVideoUrl(prompt: string, aspectRatio: string): Promise<string> {
  ensureFal()
  const result = await fal.subscribe('fal-ai/kling-video/v2.5-turbo/pro/text-to-video', {
    input: {
      prompt,
      duration: '5',
      aspect_ratio: aspectRatio,
      negative_prompt: 'blur, distort, low quality, watermark',
      cfg_scale: 0.5,
    },
    logs: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  const data = result.data as { video?: { url: string } }
  if (!data.video?.url) throw new Error('No video generated')
  return data.video.url
}

/** Üretir, fal CDN'den indirir ve social-media bucket'a kaydeder. */
export async function generateAndStoreMedia(userId: string, input: GenerateMediaInput): Promise<GeneratedMedia> {
  if (!process.env.FAL_KEY) throw new Error('FAL_KEY not configured')
  if (!supabase) throw new Error('storage_unavailable')

  let sourceUrl: string
  let width: number | undefined
  let height: number | undefined

  if (input.kind === 'video') {
    sourceUrl = await generateVideoUrl(input.prompt, input.aspectRatio || '9:16')
  } else {
    const img = await generateImage({ prompt: input.prompt, aspectRatio: input.aspectRatio || '1:1' })
    sourceUrl = img.url
    width = img.width
    height = img.height
  }

  // fal CDN → social-media bucket
  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`generated_media_fetch_failed: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || (input.kind === 'video' ? 'video/mp4' : 'image/jpeg')
  const ext = input.kind === 'video'
    ? 'mp4'
    : contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const path = `${userId}/${randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: false })
  if (error) throw new Error(`storage_upload_failed: ${error.message}`)
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return { storagePath: path, publicUrl: pub.publicUrl, mediaType: input.kind, width, height }
}
