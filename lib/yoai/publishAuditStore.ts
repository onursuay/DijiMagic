/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Publish Audit Store (Faz 0A — hazırlık)

   Her publish denemesinin (one-click-approve / execute-action /
   direct campaign create) auditlenebilir kaydı için yardımcı
   fonksiyonlar.

   ⚠️  Faz 0A: Bu helper publish endpoint'lerine BAĞLANMAMIŞTIR.
   Sadece sonraki fazda non-blocking şekilde çağrılabilmesi için
   hazırlık olarak eklenmiştir. Mevcut publish davranışı bu fazda
   değişmez.

   Persistence: Supabase tablosu `yoai_publish_audit_log`.
   Migration:   supabase/migrations/20260510001000_create_yoai_publish_audit_log.sql

   Tablo yoksa: insert/update operasyonları AUDIT_LOSS olarak
   structured log'a yazılır; fonksiyon null/false döner ve
   çağıran kodu kırmaz.
   ────────────────────────────────────────────────────────── */

import { createHash } from 'crypto'
import { supabase } from '@/lib/supabase/client'

const TABLE_MIGRATION_HINT =
  'supabase/migrations/20260510001000_create_yoai_publish_audit_log.sql'

export type PublishAuditStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'blocked'
  | 'orphaned'
  | 'rolled_back'

export interface PublishAuditAttempt {
  user_id: string
  proposal_id?: string | null
  platform: string
  source_campaign_id?: string | null
  status: PublishAuditStatus
  action_type?: string | null
  payload_hash?: string | null
  payload_excerpt?: unknown
  response_excerpt?: unknown
  error_message?: string | null
  orphan_resources?: unknown
  budget_amount?: number | null
  currency?: string | null
}

export interface PublishAuditUpdate {
  response_excerpt?: unknown
  error_message?: string | null
  orphan_resources?: unknown
  budget_amount?: number | null
  currency?: string | null
}

function isTableMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || /relation .* does not exist/i.test(error.message || '')
}

/**
 * Yeni bir publish audit row insert eder.
 * Tablo yoksa AUDIT_LOSS log + null döner.
 */
export async function recordPublishAuditAttempt(
  rec: PublishAuditAttempt,
): Promise<{ id: string } | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('yoai_publish_audit_log')
    .insert({
      user_id: rec.user_id,
      proposal_id: rec.proposal_id ?? null,
      platform: rec.platform,
      source_campaign_id: rec.source_campaign_id ?? null,
      status: rec.status,
      action_type: rec.action_type ?? null,
      payload_hash: rec.payload_hash ?? null,
      payload_excerpt: rec.payload_excerpt ?? null,
      response_excerpt: rec.response_excerpt ?? null,
      error_message: rec.error_message ?? null,
      orphan_resources: rec.orphan_resources ?? [],
      budget_amount: rec.budget_amount ?? null,
      currency: rec.currency ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (isTableMissingError(error)) {
      console.error(
        '[PublishAuditStore][AUDIT_LOSS] yoai_publish_audit_log tablosu yok — publish audit KAYBEDİLDİ. ' +
          `Migration uygulayın: ${TABLE_MIGRATION_HINT}`,
        {
          platform: rec.platform,
          status: rec.status,
          proposal_id: rec.proposal_id ?? null,
          action_type: rec.action_type ?? null,
        },
      )
      return null
    }
    console.error('[PublishAuditStore] insert error:', error)
    return null
  }
  return data as { id: string }
}

/**
 * Mevcut bir publish audit row'unun status'unu (ve opsiyonel ek alanları) günceller.
 * Tablo yoksa AUDIT_LOSS log + false döner.
 */
export async function updatePublishAuditStatus(
  id: string,
  status: PublishAuditStatus,
  fields?: PublishAuditUpdate,
): Promise<boolean> {
  if (!supabase) return false

  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (fields?.response_excerpt !== undefined) payload.response_excerpt = fields.response_excerpt
  if (fields?.error_message !== undefined) payload.error_message = fields.error_message
  if (fields?.orphan_resources !== undefined) payload.orphan_resources = fields.orphan_resources
  if (fields?.budget_amount !== undefined) payload.budget_amount = fields.budget_amount
  if (fields?.currency !== undefined) payload.currency = fields.currency

  const { error } = await supabase
    .from('yoai_publish_audit_log')
    .update(payload)
    .eq('id', id)

  if (error) {
    if (isTableMissingError(error)) {
      console.error(
        '[PublishAuditStore][AUDIT_LOSS] yoai_publish_audit_log tablosu yok — update KAYBEDİLDİ. ' +
          `Migration uygulayın: ${TABLE_MIGRATION_HINT}`,
        { id, status },
      )
      return false
    }
    console.error('[PublishAuditStore] update error:', error)
    return false
  }
  return true
}

/**
 * Payload'ın deterministik SHA-256 hash'ini hex döner.
 * Replay/dedupe detection için kullanılabilir.
 */
export function hashPayload(payload: unknown): string {
  try {
    const json = typeof payload === 'string' ? payload : JSON.stringify(payload)
    if (!json) return ''
    return createHash('sha256').update(json).digest('hex')
  } catch {
    return ''
  }
}

const SENSITIVE_KEYS = new Set([
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'token',
  'authorization',
  'password',
  'secret',
  'api_key',
  'apikey',
  'client_secret',
  'clientsecret',
  'cookie',
  'set-cookie',
])

/**
 * Audit log'a yazılmadan önce response/payload'dan hassas alanları
 * recursive olarak [REDACTED] olarak işaretler ve ölçüyü sınırlar.
 * Audit kaydı için güvenli, kompakt bir gösterim üretir.
 */
export function sanitizeResponseExcerpt(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[...]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    if (value.length > 2000) return value.slice(0, 2000) + '…'
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => sanitizeResponseExcerpt(v, depth + 1))
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]'
    } else {
      out[k] = sanitizeResponseExcerpt(v, depth + 1)
    }
  }
  return out
}
