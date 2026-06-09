/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Official Ads Knowledge Decision (Alt-Proje B onay akışı)

   review_required taslakların admin onay/ret işlemleri. supabase client
   parametre olarak alınır (DI → test edilebilir, @/ alias yüklemez).

   approve: önceki onaylı versiyonu emekliye ayır (effective_to + deprecated),
            yeni versiyonu approved yap. loadFromDB (effective_to IS NULL +
            approved) otomatik yeni versiyona geçer.
   reject:  deprecated (soft-delete, denetim izi).
   ────────────────────────────────────────────────────────── */

import type { OfficialAdsKnowledgeItem } from './officialAdsKnowledgeStore'

const TABLE = 'official_ads_knowledge_items'

export interface PendingKnowledgeEntry {
  item: OfficialAdsKnowledgeItem
  /** Aynı normalized_key'in yürürlükteki onaylı versiyonu (diff için), yoksa null */
  current: OfficialAdsKnowledgeItem | null
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** review_required taslakları + her biri için yürürlükteki onaylı versiyon (diff). */
export async function listPendingKnowledge(supabase: any): Promise<PendingKnowledgeEntry[]> {
  if (!supabase) return []
  const { data: pending } = await supabase
    .from(TABLE)
    .select('*')
    .eq('review_status', 'review_required')
    .order('platform')
    .order('created_at', { ascending: false })

  const drafts = (Array.isArray(pending) ? pending : []) as OfficialAdsKnowledgeItem[]
  if (!drafts.length) return []

  const keys = Array.from(new Set(drafts.map((d) => d.normalized_key)))
  let approved: OfficialAdsKnowledgeItem[] = []
  try {
    const { data } = await supabase
      .from(TABLE)
      .select('*')
      .in('normalized_key', keys)
      .in('review_status', ['approved', 'auto_approved'])
      .is('effective_to', null)
    if (Array.isArray(data)) approved = data as OfficialAdsKnowledgeItem[]
  } catch {
    /* yürürlükteki versiyon yoksa diff'siz devam */
  }

  const currentByKey = new Map<string, OfficialAdsKnowledgeItem>()
  for (const a of approved) currentByKey.set(a.normalized_key, a)

  return drafts.map((item) => ({ item, current: currentByKey.get(item.normalized_key) ?? null }))
}

/** Taslağı onaylar; aynı key'in önceki onaylı versiyonunu emekliye ayırır. */
export async function approveKnowledgeItem(
  supabase: any,
  id: string,
  byEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'supabase_unavailable' }

  const { data: rows } = await supabase
    .from(TABLE)
    .select('id, platform, normalized_key, version, review_status')
    .eq('id', id)
    .limit(1)
  const target = Array.isArray(rows) ? rows[0] : null
  if (!target) return { ok: false, error: 'not_found' }
  if (target.review_status !== 'review_required') return { ok: false, error: 'not_pending' }

  const day = today()

  // 1) Önceki yürürlükteki onaylı versiyon(lar)ı emekliye ayır
  await supabase
    .from(TABLE)
    .update({ review_status: 'deprecated', effective_to: day })
    .eq('normalized_key', target.normalized_key)
    .in('review_status', ['approved', 'auto_approved'])
    .is('effective_to', null)

  // 2) Hedef taslağı onayla → yürürlüğe al
  const { error } = await supabase
    .from(TABLE)
    .update({
      review_status: 'approved',
      approved_by: byEmail,
      approved_at: new Date().toISOString(),
      effective_from: day,
      effective_to: null,
    })
    .eq('id', id)

  if (error) return { ok: false, error: String(error.message || error) }
  return { ok: true }
}

/** Taslağı reddeder (deprecated — denetim izi kalır). */
export async function rejectKnowledgeItem(
  supabase: any,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'supabase_unavailable' }
  const { error } = await supabase
    .from(TABLE)
    .update({ review_status: 'deprecated' })
    .eq('id', id)
  if (error) return { ok: false, error: String(error.message || error) }
  return { ok: true }
}
