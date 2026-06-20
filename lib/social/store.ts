/**
 * Sosyal Medya Yönetimi — veri erişim katmanı.
 * Tüm DB erişimi (social_* tabloları) burada izole edilir. Service role client
 * kullanılır; uygulama katmanı user_id ile filtreler (RLS service-role bypass).
 */
import 'server-only'
import { supabase } from '@/lib/supabase/client'
import type {
  SocialProject,
  SocialPostWithRelations,
  SocialPostTarget,
  SocialPostMedia,
  SocialScheduledPost,
  CreateProjectInput,
  CreatePostInput,
  UpdatePostInput,
  ListPostsRange,
} from './types'

const MAX_ATTEMPTS = 3
// 'publishing'de bu süreden uzun takılı kalan post stranded sayılır ve yeniden claim edilir.
const STALE_PUBLISHING_MS = 10 * 60_000

function db() {
  if (!supabase) throw new Error('supabase_unavailable')
  return supabase
}

/* ----------------------------- Projects ----------------------------- */

export async function listProjects(userId: string): Promise<SocialProject[]> {
  const { data, error } = await db()
    .from('social_projects')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) { console.error('[social.store] listProjects', error.message); return [] }
  return (data ?? []) as SocialProject[]
}

export async function createProject(userId: string, input: CreateProjectInput): Promise<SocialProject | null> {
  const { data, error } = await db()
    .from('social_projects')
    .insert({
      user_id: userId,
      name: input.name,
      color: input.color || '#10b981',
      business_scope: input.businessScope ?? null,
    })
    .select('*')
    .single()
  if (error) { console.error('[social.store] createProject', error.message); return null }
  return data as SocialProject
}

export async function updateProject(
  userId: string,
  id: string,
  patch: Partial<Pick<SocialProject, 'name' | 'color' | 'business_scope' | 'status'>>,
): Promise<boolean> {
  const { error } = await db()
    .from('social_projects')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) { console.error('[social.store] updateProject', error.message); return false }
  return true
}

export async function archiveProject(userId: string, id: string): Promise<boolean> {
  return updateProject(userId, id, { status: 'archived' })
}

/* ------------------------------ Posts ------------------------------- */

async function attachRelations(posts: SocialScheduledPost[]): Promise<SocialPostWithRelations[]> {
  if (posts.length === 0) return []
  const ids = posts.map((p) => p.id)
  const [{ data: targets }, { data: media }] = await Promise.all([
    db().from('social_post_targets').select('*').in('post_id', ids),
    db().from('social_post_media').select('*').in('post_id', ids).order('sort_order', { ascending: true }),
  ])
  const targetsByPost = new Map<string, SocialPostTarget[]>()
  for (const t of (targets ?? []) as SocialPostTarget[]) {
    const arr = targetsByPost.get(t.post_id) ?? []
    arr.push(t)
    targetsByPost.set(t.post_id, arr)
  }
  const mediaByPost = new Map<string, SocialPostMedia[]>()
  for (const m of (media ?? []) as SocialPostMedia[]) {
    const arr = mediaByPost.get(m.post_id) ?? []
    arr.push(m)
    mediaByPost.set(m.post_id, arr)
  }
  return posts.map((p) => ({
    ...p,
    targets: targetsByPost.get(p.id) ?? [],
    media: mediaByPost.get(p.id) ?? [],
  }))
}

export async function listPostsInRange(userId: string, range: ListPostsRange): Promise<SocialPostWithRelations[]> {
  let q = db()
    .from('social_scheduled_posts')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .gte('scheduled_at', range.from)
    .lte('scheduled_at', range.to)
    .order('scheduled_at', { ascending: true })
  if (range.projectId) q = q.eq('project_id', range.projectId)
  if (range.format) q = q.eq('format', range.format)
  const { data, error } = await q
  if (error) { console.error('[social.store] listPostsInRange', error.message); return [] }
  return attachRelations((data ?? []) as SocialScheduledPost[])
}

export async function getPost(userId: string, id: string): Promise<SocialPostWithRelations | null> {
  const { data, error } = await db()
    .from('social_scheduled_posts')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  const [withRel] = await attachRelations([data as SocialScheduledPost])
  return withRel ?? null
}

/** projectId verilmişse sahipliği doğrular; sahibi değilse null döner (cross-user dangling referans engeli). */
async function resolveOwnedProjectId(userId: string, projectId: string | null | undefined): Promise<string | null> {
  if (!projectId) return null
  const { data } = await db()
    .from('social_projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()
  return data ? projectId : null
}

export async function createPost(userId: string, input: CreatePostInput): Promise<SocialPostWithRelations | null> {
  const client = db()
  const projectId = await resolveOwnedProjectId(userId, input.projectId)
  const { data: post, error } = await client
    .from('social_scheduled_posts')
    .insert({
      user_id: userId,
      project_id: projectId,
      format: input.format,
      caption: input.caption ?? null,
      scheduled_at: input.scheduledAt,
      timezone: input.timezone || 'Europe/Istanbul',
      source: input.source || 'upload',
      status: 'scheduled',
    })
    .select('*')
    .single()
  if (error || !post) { console.error('[social.store] createPost', error?.message); return null }

  const postId = (post as SocialScheduledPost).id
  const targetRows = input.targets.map((t) => ({
    post_id: postId,
    platform: t.platform,
    page_id: t.pageId,
    ig_user_id: t.igUserId ?? null,
    account_label: t.accountLabel ?? null,
  }))
  const mediaRows = input.media.map((m, i) => ({
    post_id: postId,
    media_type: m.mediaType,
    storage_path: m.storagePath,
    public_url: m.publicUrl,
    sort_order: m.sortOrder ?? i,
    width: m.width ?? null,
    height: m.height ?? null,
    duration: m.duration ?? null,
  }))

  const [tRes, mRes] = await Promise.all([
    targetRows.length ? client.from('social_post_targets').insert(targetRows) : Promise.resolve({ error: null }),
    mediaRows.length ? client.from('social_post_media').insert(mediaRows) : Promise.resolve({ error: null }),
  ])
  if (tRes.error || mRes.error) {
    // Best-effort rollback — yarım kayıt bırakma.
    console.error('[social.store] createPost relations', tRes.error?.message || mRes.error?.message)
    await client.from('social_scheduled_posts').delete().eq('id', postId)
    return null
  }
  return getPost(userId, postId)
}

export async function updatePost(userId: string, id: string, patch: UpdatePostInput): Promise<boolean> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.projectId !== undefined) fields.project_id = await resolveOwnedProjectId(userId, patch.projectId)
  if (patch.caption !== undefined) fields.caption = patch.caption
  if (patch.scheduledAt !== undefined) fields.scheduled_at = patch.scheduledAt
  if (patch.status !== undefined) fields.status = patch.status
  // Yayında/yayınlanıyor olan post düzenlenemez (sadece düzenlenebilir durumlar).
  const { data, error } = await db()
    .from('social_scheduled_posts')
    .update(fields)
    .eq('id', id)
    .eq('user_id', userId)
    .in('status', ['draft', 'scheduled', 'failed'])
    .select('id')
  if (error) { console.error('[social.store] updatePost', error.message); return false }
  return (data ?? []).length > 0
}

export async function cancelPost(userId: string, id: string): Promise<boolean> {
  const { data, error } = await db()
    .from('social_scheduled_posts')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .in('status', ['draft', 'scheduled', 'failed'])
    .select('id')
  if (error) { console.error('[social.store] cancelPost', error.message); return false }
  return (data ?? []).length > 0
}

/** Başarısız post'u yeniden zamanla (kullanıcı "Tekrar dene"). attempts sıfırlanır. */
export async function retryPost(userId: string, id: string): Promise<boolean> {
  const { data, error } = await db()
    .from('social_scheduled_posts')
    .update({
      status: 'scheduled',
      scheduled_at: new Date().toISOString(),
      attempts: 0,
      last_error: null,
      next_retry_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('status', 'failed')
    .select('id')
  if (error) { console.error('[social.store] retryPost', error.message); return false }
  return (data ?? []).length > 0
}

/* --------------------------- Cron / worker -------------------------- */

/**
 * Zamanı gelen postları atomik olarak claim eder: status='scheduled' + scheduled_at<=now()
 * + (next_retry_at boş veya geçmiş) → 'publishing'. Koşullu update ile yarış koşulu yok.
 */
export async function claimDuePosts(limit = 25): Promise<SocialPostWithRelations[]> {
  const client = db()
  const nowIso = new Date().toISOString()
  const staleIso = new Date(Date.now() - STALE_PUBLISHING_MS).toISOString()

  const { data: dueScheduled, error } = await client
    .from('social_scheduled_posts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order('scheduled_at', { ascending: true })
    .limit(limit)
  if (error) { console.error('[social.store] claimDuePosts select', error.message); return [] }

  // Süreç ölümü/zaman aşımı nedeniyle 'publishing'de takılı kalmış postları kurtar.
  const { data: dueStale } = await client
    .from('social_scheduled_posts')
    .select('id')
    .eq('status', 'publishing')
    .lt('updated_at', staleIso)
    .order('updated_at', { ascending: true })
    .limit(limit)

  const claimed: SocialScheduledPost[] = []

  for (const row of (dueScheduled ?? []) as { id: string }[]) {
    const { data: upd } = await client
      .from('social_scheduled_posts')
      .update({ status: 'publishing', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'scheduled')
      .select('*')
    if (upd && upd.length > 0) claimed.push(upd[0] as SocialScheduledPost)
  }
  // Stale yeniden-claim: `updated_at < staleIso` koşulu yarış halinde atomikliği sağlar
  // (ilk claim updated_at'ı şimdiye çeker → ikinci claim 0 satır döner). Yayınlanmış
  // hedefler worker'da target_status='published' ile atlandığı için duplicate olmaz.
  for (const row of (dueStale ?? []) as { id: string }[]) {
    const { data: upd } = await client
      .from('social_scheduled_posts')
      .update({ status: 'publishing', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'publishing')
      .lt('updated_at', staleIso)
      .select('*')
    if (upd && upd.length > 0) claimed.push(upd[0] as SocialScheduledPost)
  }
  return attachRelations(claimed)
}

export async function markTargetResult(
  targetId: string,
  result: { ok: boolean; publishedId?: string; error?: string },
): Promise<void> {
  await db()
    .from('social_post_targets')
    .update({
      target_status: result.ok ? 'published' : 'failed',
      published_id: result.publishedId ?? null,
      target_error: result.ok ? null : (result.error ?? 'unknown'),
    })
    .eq('id', targetId)
}

export async function markPostPublished(postId: string): Promise<void> {
  await db()
    .from('social_scheduled_posts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      last_error: null,
      next_retry_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
}

/**
 * Post yayını başarısız: attempts++. Limit aşılmadıysa retry için 'scheduled'a geri
 * döndürür. Aşıldıysa: en az bir hedef yayınlanmışsa 'partial' (kısmen yayınlandı),
 * hiç yayınlanmamışsa 'failed' olarak kalıcı işaretler.
 */
export async function markPostFailed(post: SocialScheduledPost, error: string, hasPublishedTarget = false): Promise<void> {
  const attempts = (post.attempts ?? 0) + 1
  const canRetry = attempts < MAX_ATTEMPTS
  const backoffMin = Math.pow(2, attempts) * 5 // 10, 20, 40 dk
  const finalStatus = canRetry ? 'scheduled' : hasPublishedTarget ? 'partial' : 'failed'
  await db()
    .from('social_scheduled_posts')
    .update({
      status: finalStatus,
      attempts,
      last_error: error.slice(0, 500),
      next_retry_at: canRetry ? new Date(Date.now() + backoffMin * 60_000).toISOString() : null,
      published_at: finalStatus === 'partial' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', post.id)
}
