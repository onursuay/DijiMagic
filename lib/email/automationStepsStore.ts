import 'server-only'
import { supabase } from '@/lib/supabase/client'

export interface StepRow {
  id: string
  automation_id: string
  step_order: number
  subject: string
  html: string
  delay_days: number
  created_at: string
}

export interface StepInput {
  step_order: number
  subject: string
  html: string
  delay_days: number
}

export async function listSteps(automationId: string): Promise<StepRow[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('email_automation_steps')
    .select('*')
    .eq('automation_id', automationId)
    .order('step_order', { ascending: true })
  return (data ?? []) as StepRow[]
}

export async function replaceSteps(automationId: string, steps: StepInput[]): Promise<void> {
  if (!supabase) return
  await supabase.from('email_automation_steps').delete().eq('automation_id', automationId)
  if (steps.length === 0) return
  const rows = steps.map((s) => ({ ...s, automation_id: automationId }))
  await supabase.from('email_automation_steps').insert(rows)
}
