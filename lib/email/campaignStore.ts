import 'server-only'
import { supabase } from '@/lib/supabase/client'
import type { Segment } from './segments'

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'

export interface CampaignRow {
  id: string
  user_id: string
  name: string
  subject: string
  from_name: string | null
  from_email: string | null
  html: string
  segment: Segment | Record<string, unknown>
  status: CampaignStatus
  scheduled_at: string | null
  sent_at: string | null
  stats: Record<string, number>
  created_at: string
  updated_at: string
}

export async function listCampaigns(userId: string): Promise<CampaignRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('[EmailCampaign] LIST_FAIL', error.message); return [] }
  return (data ?? []) as CampaignRow[]
}

export async function getCampaign(id: string, userId: string): Promise<CampaignRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('email_campaigns').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
  if (error || !data) return null
  return data as CampaignRow
}

export interface UpsertCampaignInput {
  id?: string
  name?: string
  subject?: string
  fromName?: string | null
  fromEmail?: string | null
  html?: string
  segment?: Segment
  scheduledAt?: string | null
  status?: CampaignStatus
}

export async function upsertCampaign(userId: string, input: UpsertCampaignInput): Promise<CampaignRow | null> {
  if (!supabase) return null
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = { user_id: userId, updated_at: now }
  if (input.name !== undefined) payload.name = input.name
  if (input.subject !== undefined) payload.subject = input.subject
  if (input.fromName !== undefined) payload.from_name = input.fromName
  if (input.fromEmail !== undefined) payload.from_email = input.fromEmail
  if (input.html !== undefined) payload.html = input.html
  if (input.segment !== undefined) payload.segment = input.segment
  if (input.scheduledAt !== undefined) payload.scheduled_at = input.scheduledAt
  if (input.status !== undefined) payload.status = input.status

  if (input.id) {
    const { data, error } = await supabase.from('email_campaigns').update(payload).eq('id', input.id).eq('user_id', userId).select().single()
    if (error || !data) { console.error('[EmailCampaign] UPDATE_FAIL', error?.message); return null }
    return data as CampaignRow
  }
  payload.created_at = now
  const { data, error } = await supabase.from('email_campaigns').insert(payload).select().single()
  if (error || !data) { console.error('[EmailCampaign] INSERT_FAIL', error?.message); return null }
  return data as CampaignRow
}

export async function deleteCampaign(id: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('email_campaigns').delete().eq('id', id).eq('user_id', userId)
  return !error
}

export async function markCampaign(id: string, patch: { status?: CampaignStatus; sentAt?: string | null; stats?: Record<string, number> }): Promise<void> {
  if (!supabase) return
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status !== undefined) updates.status = patch.status
  if (patch.sentAt !== undefined) updates.sent_at = patch.sentAt
  if (patch.stats !== undefined) updates.stats = patch.stats
  await supabase.from('email_campaigns').update(updates).eq('id', id)
}

/** Cron için: gönderim zamanı gelmiş zamanlanmış kampanyalar (tüm kullanıcılar). */
export async function listDueScheduledCampaigns(nowIso: string): Promise<CampaignRow[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
  return (data ?? []) as CampaignRow[]
}
