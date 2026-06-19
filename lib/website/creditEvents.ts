import 'server-only'
/**
 * lib/website/creditEvents.ts
 *
 * Step-by-step credit TELEMETRY store (#builder-5b).
 *
 * `website_credit_events` is a website-specific DISPLAY/UX stream that BREAKS DOWN
 * the SINGLE real charge (chargeFeature → credit_transactions — the atomic ledger,
 * UNCHANGED) into per-phase events for the CreditUsageTimeline UI. These rows are
 * telemetry, NOT real debits: writing them spends NO credits and there is no
 * double-charge. The per-phase credit_delta values sum to the one charged total
 * (see lib/website/creditBreakdown.mjs).
 *
 * FAIL-SOFT: every write is wrapped in try/catch. If the migration
 * (20260619100000_website_event_logs.sql) is not applied yet — or any DB error
 * occurs — we console.warn and return. Logging telemetry must NEVER throw or
 * break a generation / publish / edit flow.
 */
import { supabase } from '@/lib/supabase/client'
import { getWebsite } from './store'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import { buildPhaseBreakdown as _buildPhaseBreakdown, PHASE_ORDER as _PHASE_ORDER } from './creditBreakdown.mjs'

export type CreditEventPhase =
  | 'designSystem'
  | 'blueprint'
  | 'render'
  | 'images'
  | 'translate'
  | 'publish'
  | 'custom_component'

export type CreditEventStatus = 'charged' | 'refunded'

export interface CreditEventInput {
  websiteId: string
  userId: string
  versionId?: string | null
  phase: CreditEventPhase
  creditDelta: number
  creditTransactionId?: string | null
  status?: CreditEventStatus
  detail?: Record<string, unknown>
}

export interface CreditEvent {
  id: string
  websiteId: string
  userId: string
  versionId: string | null
  phase: string
  creditDelta: number
  creditTransactionId: string | null
  status: CreditEventStatus
  detail: Record<string, unknown>
  createdAt: string
}

interface BreakdownPhase {
  phase: Exclude<CreditEventPhase, 'publish' | 'custom_component'> | 'publish'
  creditDelta: number
  detail: Record<string, unknown>
}

const buildPhaseBreakdown = _buildPhaseBreakdown as (
  total: number,
  ctx: { pageCount?: number; localeCount?: number; hasImages?: boolean },
) => BreakdownPhase[]

export const PHASE_ORDER = _PHASE_ORDER as string[]

/**
 * Insert ONE credit-event row (TELEMETRY only — never a real debit). FAIL-SOFT:
 * any error (table missing pre-migration, no client, RLS, etc.) is swallowed with
 * a console.warn so generation/publish/edit flows are never broken.
 */
export async function logCreditEvent(input: CreditEventInput): Promise<void> {
  try {
    if (!supabase) return // Supabase not configured → no-op (fail-soft).
    const { error } = await supabase.from('website_credit_events').insert({
      website_id: input.websiteId,
      user_id: input.userId,
      version_id: input.versionId ?? null,
      phase: input.phase,
      credit_delta: Math.round(input.creditDelta || 0),
      credit_transaction_id: input.creditTransactionId ?? null,
      status: input.status ?? 'charged',
      detail: input.detail ?? {},
    })
    if (error) {
      console.warn('[website:creditEvents] log skipped (fail-soft):', error.message)
    }
  } catch (e) {
    console.warn('[website:creditEvents] log threw (fail-soft):', e instanceof Error ? e.message : e)
  }
}

/**
 * Log a per-phase BREAKDOWN of a SINGLE charged total across the phases that ran.
 * The per-phase deltas sum EXACTLY to `chargedTotal` (creditBreakdown.mjs) — this
 * is display telemetry that DESCRIBES the one real charge, it does not add to it.
 * Owner / zero-cost runs → every phase is logged with creditDelta 0.
 *
 * Each insert is independent + fail-soft (one bad row never aborts the rest).
 */
export async function logGenerationBreakdown(args: {
  websiteId: string
  userId: string
  versionId?: string | null
  chargedTotal: number
  pageCount: number
  localeCount: number
  hasImages?: boolean
}): Promise<void> {
  const breakdown = buildPhaseBreakdown(args.chargedTotal, {
    pageCount: args.pageCount,
    localeCount: args.localeCount,
    hasImages: args.hasImages,
  })
  for (const b of breakdown) {
    await logCreditEvent({
      websiteId: args.websiteId,
      userId: args.userId,
      versionId: args.versionId ?? null,
      phase: b.phase as CreditEventPhase,
      creditDelta: b.creditDelta,
      status: 'charged',
      detail: b.detail,
    })
  }
}

/**
 * Log a single 'refunded' total event for a generation that was charged then
 * refunded (gate-fail / persist-fail). Telemetry only — the real refund happens
 * via access.refund() in the route (atomic ledger). FAIL-SOFT.
 */
export async function logGenerationRefund(args: {
  websiteId: string
  userId: string
  refundedTotal: number
}): Promise<void> {
  if (!(args.refundedTotal > 0)) return // owner / 0-cost → nothing to mirror.
  await logCreditEvent({
    websiteId: args.websiteId,
    userId: args.userId,
    phase: 'render',
    creditDelta: -Math.round(args.refundedTotal),
    status: 'refunded',
    detail: { reason: 'generation_refunded' },
  })
}

interface CreditEventRow {
  id: string
  website_id: string
  user_id: string
  version_id: string | null
  phase: string
  credit_delta: number
  credit_transaction_id: string | null
  status: CreditEventStatus
  detail: Record<string, unknown> | null
  created_at: string
}

function rowToCreditEvent(r: CreditEventRow): CreditEvent {
  return {
    id: r.id,
    websiteId: r.website_id,
    userId: r.user_id,
    versionId: r.version_id,
    phase: r.phase,
    creditDelta: r.credit_delta,
    creditTransactionId: r.credit_transaction_id,
    status: r.status,
    detail: r.detail ?? {},
    createdAt: r.created_at,
  }
}

/**
 * Owner-scoped credit events for a site (most recent first) — feeds the stream
 * endpoint / CreditUsageTimeline. Ownership is verified via getWebsite (user_id +
 * id); a non-owner / missing site → []. FAIL-SOFT: any DB error (table missing
 * pre-migration) → [] (the timeline simply shows nothing yet).
 */
export async function getCreditEvents(userId: string, websiteId: string): Promise<CreditEvent[]> {
  try {
    if (!supabase) return []
    const site = await getWebsite(userId, websiteId)
    if (!site) return []
    const { data, error } = await supabase
      .from('website_credit_events')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      console.warn('[website:creditEvents] read skipped (fail-soft):', error.message)
      return []
    }
    return (data as CreditEventRow[]).map(rowToCreditEvent)
  } catch (e) {
    console.warn('[website:creditEvents] read threw (fail-soft):', e instanceof Error ? e.message : e)
    return []
  }
}
