import 'server-only'
import { supabase } from '@/lib/supabase/client'

/**
 * Segment → alıcı çözümü. Kampanya kime gidecek?
 *   all        : tüm kişiler (opt-out hariç)
 *   source     : kaynağa göre (crm/csv/sheets)
 *   crm_stage  : CRM aşamasındaki lead'ler (doğrudan crm_leads'ten)
 *   list       : bir listenin üyeleri
 */
export type Segment =
  | { type: 'all' }
  | { type: 'source'; source: string }
  | { type: 'crm_stage'; stage: string }
  | { type: 'list'; listId: string }

export interface Recipient {
  email: string
  fullName: string | null
  contactId: string | null
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function resolveRecipients(userId: string, segment: Segment): Promise<Recipient[]> {
  if (!supabase) return []
  const map = new Map<string, Recipient>()
  const add = (email: string | null, fullName: string | null, contactId: string | null) => {
    const e = (email || '').trim().toLowerCase()
    if (!e || !EMAIL_RE.test(e) || map.has(e)) return
    map.set(e, { email: e, fullName: fullName || null, contactId })
  }

  if (segment.type === 'crm_stage') {
    const { data } = await supabase
      .from('crm_leads')
      .select('email, full_name, email_opt_out')
      .eq('user_id', userId)
      .eq('status', segment.stage)
      .not('email', 'is', null)
    for (const l of (data ?? []) as Array<{ email: string; full_name: string | null; email_opt_out?: boolean }>) {
      if (!l.email_opt_out) add(l.email, l.full_name, null)
    }
  } else if (segment.type === 'list') {
    const { data } = await supabase
      .from('email_list_members')
      .select('email_contacts!inner(id, email, full_name, opt_out, user_id)')
      .eq('list_id', segment.listId)
    type EC = { id: string; email: string; full_name: string | null; opt_out: boolean; user_id: string }
    for (const m of (data ?? []) as unknown as Array<{ email_contacts: EC | EC[] }>) {
      const c = Array.isArray(m.email_contacts) ? m.email_contacts[0] : m.email_contacts
      if (c && c.user_id === userId && !c.opt_out) add(c.email, c.full_name, c.id)
    }
  } else {
    let q = supabase
      .from('email_contacts')
      .select('id, email, full_name, source')
      .eq('user_id', userId)
      .eq('opt_out', false)
    if (segment.type === 'source') q = q.eq('source', segment.source)
    const { data } = await q
    for (const c of (data ?? []) as Array<{ id: string; email: string; full_name: string | null }>) {
      add(c.email, c.full_name, c.id)
    }
  }

  return [...map.values()]
}

export async function countRecipients(userId: string, segment: Segment): Promise<number> {
  return (await resolveRecipients(userId, segment)).length
}
