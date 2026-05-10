/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Learning Store (v1: veri biriktirme)

   Amaç: YoAlgoritma önerilerini ve kullanıcının uyguladığı
   aksiyonları izlemek. v1'de SADECE KAYIT; sonuç analizi
   (outcome evaluation) v2'ye bırakıldı.

   Persistence: Supabase tablosu `yoai_action_outcomes`.
   Migration: supabase/migrations/20260510000000_create_yoai_action_outcomes.sql
   (Faz 0A öncesinde sadece docs/sql altında manuel SQL idi.)

   Tablo yoksa: insert/update operasyonları AUDIT_LOSS olarak
   structured log'a yazılır (sessiz no-op DEĞİL); fonksiyon
   null/false/[] döner ve çağıran kodu kırmaz.

   NOT: mevcut dailyRunStore değiştirilmedi. Bu ayrı bir katman.
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'
import type { RootCauseId } from './meta/diagnosis'
import type { DecisionActionType } from './meta/decision'

const TABLE_MIGRATION_HINT =
  'supabase/migrations/20260510000000_create_yoai_action_outcomes.sql'

function isTableMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || /relation .* does not exist/i.test(error.message || '')
}

export interface ActionOutcomeRecord {
  id?: string
  user_id: string
  campaign_id: string
  campaign_name?: string | null
  /** Teşhisin kök nedeni (varsa) */
  root_cause: RootCauseId | null
  /** Önerilen aksiyon türü */
  action_type: DecisionActionType
  /** Önerinin tam içeriği (decision snapshot) — JSONB */
  suggestion_payload: unknown
  /** Kullanıcı aksiyonu gerçekten uyguladı mı? */
  applied: boolean
  /** Uygulandıysa ne zaman */
  applied_at?: string | null
  /** Uygulamanın sonucu (v2'de doldurulacak — v1'de null) */
  outcome_summary?: string | null
  /** Uygulama anındaki kampanya metriği snapshot'ı (JSONB) */
  metrics_before?: unknown
  /** N gün sonra ölçülecek metrikler (v2) */
  metrics_after?: unknown
  created_at?: string
  updated_at?: string
}

/* ── Insert: suggestion recorded (hem applied=true hem applied=false için) ── */
export async function recordActionOutcome(
  rec: Omit<ActionOutcomeRecord, 'id' | 'created_at' | 'updated_at'>,
): Promise<ActionOutcomeRecord | null> {
  if (!supabase) return null

  const now = new Date().toISOString()
  const payload = {
    user_id: rec.user_id,
    campaign_id: rec.campaign_id,
    campaign_name: rec.campaign_name || null,
    root_cause: rec.root_cause,
    action_type: rec.action_type,
    suggestion_payload: rec.suggestion_payload,
    applied: rec.applied,
    applied_at: rec.applied_at || (rec.applied ? now : null),
    outcome_summary: rec.outcome_summary || null,
    metrics_before: rec.metrics_before ?? null,
    metrics_after: rec.metrics_after ?? null,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('yoai_action_outcomes')
    .insert(payload)
    .select()
    .single()

  if (error) {
    if (isTableMissingError(error)) {
      // AUDIT_LOSS: tablo yoksa kayıt KAYBEDILIYOR — sessiz no-op değil,
      // structured log ile görünür hale getir. Çağıran flow null'a göre
      // mevcut davranışını koruyabilir; bu fonksiyon HALA throw ETMEZ.
      console.error(
        '[LearningStore][AUDIT_LOSS] yoai_action_outcomes tablosu yok — kayıt KAYBEDİLDİ. ' +
          `Migration uygulayın: ${TABLE_MIGRATION_HINT}`,
        {
          campaign_id: rec.campaign_id,
          action_type: rec.action_type,
          applied: rec.applied,
          root_cause: rec.root_cause,
          timestamp: now,
        },
      )
      return null
    }
    console.error('[LearningStore] insert error:', error)
    return null
  }
  return data as ActionOutcomeRecord
}

/* ── List: kullanıcının son N kaydı ── */
export async function listActionOutcomes(
  userId: string,
  limit = 100,
): Promise<ActionOutcomeRecord[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('yoai_action_outcomes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isTableMissingError(error)) {
      console.warn(
        '[LearningStore] yoai_action_outcomes tablosu yok — boş liste döndü. ' +
          `Migration uygulayın: ${TABLE_MIGRATION_HINT}`,
      )
      return []
    }
    console.error('[LearningStore] list error:', error)
    return []
  }
  return (data || []) as ActionOutcomeRecord[]
}

/* ── List by campaign ── */
export async function listActionOutcomesForCampaign(
  userId: string,
  campaignId: string,
): Promise<ActionOutcomeRecord[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('yoai_action_outcomes')
    .select('*')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  if (error) {
    if (isTableMissingError(error)) {
      console.warn(
        '[LearningStore] yoai_action_outcomes tablosu yok — boş liste döndü. ' +
          `Migration uygulayın: ${TABLE_MIGRATION_HINT}`,
      )
      return []
    }
    console.error('[LearningStore] listByCampaign error:', error)
    return []
  }
  return (data || []) as ActionOutcomeRecord[]
}
