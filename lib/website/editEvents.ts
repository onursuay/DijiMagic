import 'server-only'
/**
 * lib/website/editEvents.ts
 *
 * Edit event TELEMETRY store (#builder-8b — visual editing).
 *
 * `website_edit_events` (migration 20260619100000_website_event_logs.sql) records a
 * row per chat/visual/product/settings edit for the activity timeline + audit. These
 * rows are TELEMETRY ONLY — they spend NO credits (the real charge is the revision
 * debit via chargeFeature → credit_transactions, the atomic ledger, UNCHANGED).
 *
 * FAIL-SOFT: every write is wrapped in try/catch. If the migration is not applied yet,
 * Supabase is unconfigured, or any DB error occurs — we console.warn and return. Logging
 * an edit event must NEVER throw or break the visual-edit PATCH flow.
 */
import { supabase } from '@/lib/supabase/client'

/** The edit categories the table CHECK constraint allows. */
export type EditKind = 'chat_patch' | 'visual_edit' | 'product' | 'settings'

export interface EditEventInput {
  websiteId: string
  userId: string
  versionId?: string | null
  editKind: EditKind
  /** The data-yoai-id block the edit targeted (null for non-block edits). */
  targetBlockId?: string | null
  /** Free-form, NON-secret detail (op, slug, locale, field, …). */
  delta?: Record<string, unknown>
}

/**
 * Log ONE website edit event. FAIL-SOFT — never throws; a logging failure must not
 * affect the edit result the user sees.
 */
export async function logEditEvent(input: EditEventInput): Promise<void> {
  try {
    if (!supabase) return // Supabase not configured → no-op (fail-soft).
    const { error } = await supabase.from('website_edit_events').insert({
      website_id: input.websiteId,
      user_id: input.userId,
      version_id: input.versionId ?? null,
      edit_kind: input.editKind,
      target_block_id: input.targetBlockId ?? null,
      delta: input.delta ?? {},
    })
    if (error) {
      console.warn('[website:editEvents] log skipped (fail-soft):', error.message)
    }
  } catch (e) {
    console.warn('[website:editEvents] log threw (fail-soft):', e instanceof Error ? e.message : e)
  }
}
