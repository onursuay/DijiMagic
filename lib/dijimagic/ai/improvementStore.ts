/* ──────────────────────────────────────────────────────────
   DijiAlgoritma — Per-Ad Improvement Store (Faz 2)

   ai_ad_improvements tablosu CRUD + lifecycle reconcile.
   Service-role supabase client kullanır (RLS bypass) — UI okuması
   RLS ile korunur, yazma yalnızca bu sunucu katmanından.
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'
import type { PerAdImprovementPayload } from './perAdAgent'

export type AdImprovementStatus =
  | 'pending' | 'approved' | 'applied' | 'rejected' | 'cancelled' | 'superseded'
export type AdImprovementPublishMode = 'auto' | 'manual_publish'

export interface AdImprovementRow {
  id: string
  user_id: string
  source_platform: 'meta' | 'google'
  source_ad_id: string
  source_ad_name: string | null
  source_campaign_id: string | null
  source_campaign_name: string | null
  source_ad_status_snapshot: string | null
  source_creative_hash: string | null
  improvement_payload: PerAdImprovementPayload | Record<string, unknown>
  confidence: number | null
  status: AdImprovementStatus
  publish_mode: AdImprovementPublishMode
  model: string | null
  run_id: string | null
  publish_audit_id: string | null
  publish_error: string | null
  publish_attempts: number
  decided_by: string | null
  decision_reason: string | null
  created_at: string
  updated_at: string
  decided_at: string | null
  applied_at: string | null
  cancelled_at: string | null
}

export interface InsertImprovementInput {
  user_id: string
  source_platform: 'meta' | 'google'
  source_ad_id: string
  source_ad_name?: string | null
  source_campaign_id?: string | null
  source_campaign_name?: string | null
  source_ad_status_snapshot?: string | null
  source_creative_hash?: string | null
  improvement_payload: PerAdImprovementPayload
  confidence?: number | null
  publish_mode: AdImprovementPublishMode
  model?: string | null
  run_id?: string | null
}

/** Reconcile için açık (pending/approved) kartlar. */
export async function listOpenImprovements(userId: string): Promise<AdImprovementRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('ai_ad_improvements')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved'])
  if (error) {
    console.error('[ImprovementStore] listOpen error:', error)
    return []
  }
  return (data ?? []) as AdImprovementRow[]
}

/**
 * Reconcile/refresh-policy için: kullanıcının TÜM statülerdeki son kartları
 * (created_at desc). Her reklam için "en son karar" buradan bulunur.
 */
export async function listRecentImprovements(userId: string, limit = 500): Promise<AdImprovementRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('ai_ad_improvements')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[ImprovementStore] listRecent error:', error)
    return []
  }
  return (data ?? []) as AdImprovementRow[]
}

/** UI listesi — opsiyonel status/platform filtresi. */
export async function listImprovementsForUser(
  userId: string,
  opts?: { statuses?: AdImprovementStatus[]; platform?: 'meta' | 'google'; limit?: number },
): Promise<AdImprovementRow[]> {
  if (!supabase) return []
  let q = supabase
    .from('ai_ad_improvements')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 200)
  if (opts?.statuses?.length) q = q.in('status', opts.statuses)
  if (opts?.platform) q = q.eq('source_platform', opts.platform)
  const { data, error } = await q
  if (error) {
    console.error('[ImprovementStore] listForUser error:', error)
    return []
  }
  return (data ?? []) as AdImprovementRow[]
}

export async function getImprovementById(userId: string, id: string): Promise<AdImprovementRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('ai_ad_improvements')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[ImprovementStore] getById error:', error)
    return null
  }
  return (data as AdImprovementRow) ?? null
}

/**
 * Yeni pending kart ekler. Partial unique index (açık kart = tek)
 * ihlali olursa (race/retry) sessizce skip — idempotent.
 */
export async function insertImprovement(input: InsertImprovementInput): Promise<{ ok: boolean }> {
  if (!supabase) return { ok: false }
  const { error } = await supabase.from('ai_ad_improvements').insert({
    user_id: input.user_id,
    source_platform: input.source_platform,
    source_ad_id: input.source_ad_id,
    source_ad_name: input.source_ad_name ?? null,
    source_campaign_id: input.source_campaign_id ?? null,
    source_campaign_name: input.source_campaign_name ?? null,
    source_ad_status_snapshot: input.source_ad_status_snapshot ?? null,
    source_creative_hash: input.source_creative_hash ?? null,
    improvement_payload: input.improvement_payload,
    confidence: input.confidence ?? null,
    status: 'pending',
    publish_mode: input.publish_mode,
    model: input.model ?? null,
    run_id: input.run_id ?? null,
  })
  if (error) {
    // 23505 = unique_violation → açık kart zaten var, sorun değil
    if ((error as { code?: string }).code === '23505') return { ok: true }
    console.error('[ImprovementStore] insert error:', error)
    return { ok: false }
  }
  return { ok: true }
}

/** Creative değiştiğinde eski açık kartı güncellendi (superseded) yap. */
export async function supersedeImprovement(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('ai_ad_improvements')
    .update({ status: 'superseded', decided_by: 'system', decided_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['pending', 'approved'])
  if (error) console.error('[ImprovementStore] supersede error:', error)
}

/** Kaynak reklam pasif olunca otomatik iptal. */
export async function cancelImprovement(id: string, reason: string): Promise<void> {
  if (!supabase) return
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('ai_ad_improvements')
    .update({ status: 'cancelled', decided_by: 'system', decision_reason: reason, cancelled_at: now, decided_at: now })
    .eq('id', id)
    .in('status', ['pending', 'approved'])
  if (error) console.error('[ImprovementStore] cancel error:', error)
}

/** Kullanıcı onayı → approved. */
export async function approveImprovement(userId: string, id: string): Promise<AdImprovementRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('ai_ad_improvements')
    .update({ status: 'approved', decided_by: userId, decided_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()
  if (error) {
    console.error('[ImprovementStore] approve error:', error)
    return null
  }
  return (data as AdImprovementRow) ?? null
}

/** Kullanıcı reddi → rejected. */
export async function rejectImprovement(userId: string, id: string, reason?: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('ai_ad_improvements')
    .update({ status: 'rejected', decided_by: userId, decision_reason: reason ?? null, decided_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .in('status', ['pending', 'approved'])
  if (error) {
    console.error('[ImprovementStore] reject error:', error)
    return false
  }
  return true
}

/** Publish başarılı → applied. */
export async function markImprovementApplied(id: string, publishAuditId?: string | null): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('ai_ad_improvements')
    .update({ status: 'applied', applied_at: new Date().toISOString(), publish_audit_id: publishAuditId ?? null, publish_error: null })
    .eq('id', id)
  if (error) console.error('[ImprovementStore] markApplied error:', error)
}

/**
 * Publish başarısız → approved'da KAL + hata notu + attempt++ (karar 1).
 * Kullanıcının onay niyeti kaybolmaz; "Tekrar Dene" mümkün.
 */
export async function markImprovementPublishError(id: string, errorMsg: string): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.from('ai_ad_improvements').select('publish_attempts').eq('id', id).maybeSingle()
  const attempts = ((data as { publish_attempts?: number } | null)?.publish_attempts ?? 0) + 1
  const { error } = await supabase
    .from('ai_ad_improvements')
    .update({ publish_error: errorMsg.slice(0, 2000), publish_attempts: attempts })
    .eq('id', id)
  if (error) console.error('[ImprovementStore] markPublishError error:', error)
}
