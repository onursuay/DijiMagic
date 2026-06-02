import 'server-only'
import { supabase } from '@/lib/supabase/client'
import type { StepRow } from './automationStepsStore'

export interface QueueItem {
  id: string
  automation_id: string
  step_id: string
  user_id: string
  contact_id: string | null
  email: string
  scheduled_at: string
  status: string
}

export async function enqueueSteps(
  userId: string,
  automationId: string,
  steps: StepRow[],
  contact: { email: string; contactId?: string | null },
): Promise<void> {
  if (!supabase || steps.length === 0) return
  const now = new Date()
  let cumulativeDays = 0
  const rows = steps.map((s) => {
    cumulativeDays += s.delay_days
    const scheduledAt = new Date(now.getTime() + cumulativeDays * 86_400_000).toISOString()
    return {
      automation_id: automationId,
      step_id: s.id,
      user_id: userId,
      contact_id: contact.contactId ?? null,
      email: contact.email,
      scheduled_at: scheduledAt,
      status: 'pending',
    }
  })
  await supabase.from('email_drip_queue').insert(rows)
}

export async function getDueItems(limit = 100): Promise<QueueItem[]> {
  if (!supabase) return []
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('email_drip_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit)
  return (data ?? []) as QueueItem[]
}

export async function markItemSent(itemId: string): Promise<void> {
  if (!supabase) return
  await supabase
    .from('email_drip_queue')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', itemId)
}

export async function markItemFailed(itemId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('email_drip_queue').update({ status: 'failed' }).eq('id', itemId)
}
