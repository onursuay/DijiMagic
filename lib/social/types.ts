/**
 * Sosyal Medya Yönetimi — paylaşılan tipler.
 * DB satır tipleri (social_* tabloları) ile UI/servis katmanı arasındaki kontrat.
 */

export type SocialFormat = 'feed' | 'reels' | 'story'

export type SocialPostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled'

export type SocialProjectStatus = 'active' | 'archived'
export type SocialPlatform = 'instagram' | 'facebook'
export type SocialMediaType = 'image' | 'video'
export type SocialTargetStatus = 'pending' | 'published' | 'failed'
export type SocialPostSource = 'upload' | 'tasarim'

export interface SocialProject {
  id: string
  user_id: string
  business_scope: string | null
  name: string
  color: string
  status: SocialProjectStatus
  created_at: string
  updated_at: string
}

export interface SocialScheduledPost {
  id: string
  user_id: string
  project_id: string | null
  format: SocialFormat
  caption: string | null
  scheduled_at: string
  timezone: string
  status: SocialPostStatus
  attempts: number
  last_error: string | null
  next_retry_at: string | null
  published_at: string | null
  source: SocialPostSource
  created_at: string
  updated_at: string
}

export interface SocialPostTarget {
  id: string
  post_id: string
  platform: SocialPlatform
  page_id: string
  ig_user_id: string | null
  account_label: string | null
  target_status: SocialTargetStatus
  target_error: string | null
  published_id: string | null
  created_at: string
}

export interface SocialPostMedia {
  id: string
  post_id: string
  media_type: SocialMediaType
  storage_path: string
  public_url: string
  sort_order: number
  width: number | null
  height: number | null
  duration: number | null
  created_at: string
}

/** Post + ilişkili hedefler + medya (takvim ve detay görünümünde kullanılır). */
export interface SocialPostWithRelations extends SocialScheduledPost {
  targets: SocialPostTarget[]
  media: SocialPostMedia[]
}

/* ---------------- Servis girdileri (create/update) ---------------- */

export interface CreateProjectInput {
  name: string
  color?: string
  businessScope?: string | null
}

export interface PostTargetInput {
  platform: SocialPlatform
  pageId: string
  igUserId?: string | null
  accountLabel?: string | null
}

export interface PostMediaInput {
  mediaType: SocialMediaType
  storagePath: string
  publicUrl: string
  sortOrder?: number
  width?: number | null
  height?: number | null
  duration?: number | null
}

export interface CreatePostInput {
  projectId?: string | null
  format: SocialFormat
  caption?: string | null
  scheduledAt: string        // ISO timestamp (UTC)
  timezone?: string
  source?: SocialPostSource
  targets: PostTargetInput[]
  media: PostMediaInput[]
}

export interface UpdatePostInput {
  projectId?: string | null
  caption?: string | null
  scheduledAt?: string
  status?: Extract<SocialPostStatus, 'scheduled' | 'cancelled' | 'draft'>
}

export interface ListPostsRange {
  from: string               // ISO
  to: string                 // ISO
  projectId?: string | null
  format?: SocialFormat
}

/** /api/social/targets yanıtı — içerik planlarken hedef seçimi. */
export interface MetaTargetAccount {
  pageId: string
  pageName: string
  pageImageUrl: string | null
  instagram: {
    igUserId: string
    username: string
    profilePictureUrl: string | null
  } | null
}
