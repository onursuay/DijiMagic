import 'server-only'
import { supabase } from '@/lib/supabase/client'

export type AutomationTrigger =
  | { type: 'crm_stage_enter'; stage: string }
  | { type: 'contact_added' }

export interface AutomationRow {
  id: string
  user_id: string
  name: string
  trigger: AutomationTrigger | Record<string, unknown>
  subject: string
  html: string
  enabled: boolean
  created_at: string
  updated_at: string
}

/** UI için: kullanıcının tüm otomasyonları (enabled + disabled). */
export async function listAutomations(userId: string): Promise<AutomationRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('email_automations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('[EmailAutomation] LIST_FAIL', error.message); return [] }
  return (data ?? []) as AutomationRow[]
}

/** Runner için: yalnız enabled otomasyonlar. */
export async function listEnabledAutomations(userId: string): Promise<AutomationRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('email_automations')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
  if (error) { console.error('[EmailAutomation] LIST_ENABLED_FAIL', error.message); return [] }
  return (data ?? []) as AutomationRow[]
}

export interface UpsertAutomationInput {
  id?: string
  name?: string
  trigger?: AutomationTrigger
  subject?: string
  html?: string
  enabled?: boolean
}

export async function upsertAutomation(userId: string, input: UpsertAutomationInput): Promise<AutomationRow | null> {
  if (!supabase) return null
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = { user_id: userId, updated_at: now }
  if (input.name !== undefined) payload.name = input.name
  if (input.trigger !== undefined) payload.trigger = input.trigger
  if (input.subject !== undefined) payload.subject = input.subject
  if (input.html !== undefined) payload.html = input.html
  if (input.enabled !== undefined) payload.enabled = input.enabled

  if (input.id) {
    const { data, error } = await supabase.from('email_automations').update(payload).eq('id', input.id).eq('user_id', userId).select().single()
    if (error || !data) { console.error('[EmailAutomation] UPDATE_FAIL', error?.message); return null }
    return data as AutomationRow
  }
  payload.created_at = now
  const { data, error } = await supabase.from('email_automations').insert(payload).select().single()
  if (error || !data) { console.error('[EmailAutomation] INSERT_FAIL', error?.message); return null }
  return data as AutomationRow
}

export async function deleteAutomation(id: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('email_automations').delete().eq('id', id).eq('user_id', userId)
  return !error
}
