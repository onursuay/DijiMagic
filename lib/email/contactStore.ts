import 'server-only'
import { supabase } from '@/lib/supabase/client'

/**
 * email_contacts erişim katmanı — birleşik kişi havuzu (CRM/CSV/Sheets/manual).
 * UNIQUE(user_id,email) tekilleştirir; service-role.
 */

export interface EmailContactRow {
  id: string
  user_id: string
  email: string
  full_name: string | null
  phone: string | null
  source: string
  crm_lead_id: string | null
  /** Meta sayfa kimliği — hesap bazlı filtre için (CRM lead'lerinde dolu). */
  page_id: string | null
  /** Reklam formuna gerçek başvuru/submit tarihi (CRM lead'lerinde dolu). */
  submitted_at: string | null
  opt_out: boolean
  created_at: string
}

export interface ContactInput {
  email: string
  fullName?: string | null
  phone?: string | null
  source?: string
  /** CRM lead bağlantısı + hesap (sayfa) + gerçek başvuru tarihi (reklam akışı). */
  crmLeadId?: string | null
  pageId?: string | null
  submittedAt?: string | null
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const normEmail = (e: string) => e.trim().toLowerCase()
const validEmail = (e: string) => EMAIL_RE.test(e)

export async function listContacts(
  userId: string,
  opts: { limit?: number; offset?: number; pageId?: string } = {},
): Promise<{ contacts: EmailContactRow[]; total: number }> {
  if (!supabase) return { contacts: [], total: 0 }
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const offset = Math.max(opts.offset ?? 0, 0)
  let q = supabase
    .from('email_contacts')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
  // Hesap (sayfa) filtresi — yalnız belirli bir Meta sayfasının kişileri.
  if (opts.pageId) q = q.eq('page_id', opts.pageId)
  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) {
    console.error('[EmailContacts] LIST_FAIL', error.message)
    return { contacts: [], total: 0 }
  }
  return { contacts: (data ?? []) as EmailContactRow[], total: count ?? 0 }
}

/** Kullanıcının kişilerinde bulunan benzersiz hesap (sayfa) kimlikleri + kişi sayısı. */
export async function listContactPageIds(userId: string): Promise<Record<string, number>> {
  if (!supabase) return {}
  const { data, error } = await supabase
    .from('email_contacts')
    .select('page_id')
    .eq('user_id', userId)
    .not('page_id', 'is', null)
  if (error) {
    console.error('[EmailContacts] PAGE_IDS_FAIL', error.message)
    return {}
  }
  const counts: Record<string, number> = {}
  for (const r of (data ?? []) as Array<{ page_id: string | null }>) {
    if (r.page_id) counts[r.page_id] = (counts[r.page_id] ?? 0) + 1
  }
  return counts
}

export async function countContacts(
  userId: string,
  opts: { pageId?: string } = {},
): Promise<{ total: number; optedOut: number }> {
  if (!supabase) return { total: 0, optedOut: 0 }
  let totalQ = supabase.from('email_contacts').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  let ooQ = supabase
    .from('email_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('opt_out', true)
  if (opts.pageId) {
    totalQ = totalQ.eq('page_id', opts.pageId)
    ooQ = ooQ.eq('page_id', opts.pageId)
  }
  const { count } = await totalQ
  const { count: oo } = await ooQ
  return { total: count ?? 0, optedOut: oo ?? 0 }
}

/** Toplu ekleme — geçersiz/yinelenen atlanır, mevcut e-posta ezilmez (idempotent). */
export async function upsertContacts(
  userId: string,
  rows: ContactInput[],
  defaultSource = 'manual',
): Promise<{ inserted: number; skipped: number }> {
  if (!supabase || !rows.length) return { inserted: 0, skipped: rows.length }
  const seen = new Set<string>()
  const payload: Record<string, unknown>[] = []
  for (const r of rows) {
    const email = normEmail(r.email || '')
    if (!validEmail(email) || seen.has(email)) continue
    seen.add(email)
    const base: Record<string, unknown> = {
      user_id: userId,
      email,
      full_name: r.fullName?.trim() || null,
      phone: r.phone?.trim() || null,
      source: r.source ?? defaultSource,
    }
    // Reklam (CRM) akışından gelen ek alanlar — yalnız değer varsa yaz.
    if (r.crmLeadId) base.crm_lead_id = r.crmLeadId
    if (r.pageId) base.page_id = r.pageId
    if (r.submittedAt) base.submitted_at = r.submittedAt
    payload.push(base)
  }
  if (!payload.length) return { inserted: 0, skipped: rows.length }

  // page_id/submitted_at kolonları migration ile gelir. Migration henüz
  // uygulanmadıysa bu alanlar olmadan tekrar dener — kişiler yine eklenir
  // (omddq migration gap'ine karşı geriye dönük uyumlu).
  const stripExtra = (r: Record<string, unknown>) => {
    const { page_id, submitted_at, ...rest } = r
    void page_id
    void submitted_at
    return rest
  }

  let inserted = 0
  let extraSupported = true
  for (let i = 0; i < payload.length; i += 500) {
    const slice = payload.slice(i, i + 500)
    const batch = extraSupported ? slice : slice.map(stripExtra)
    let { data, error } = await supabase
      .from('email_contacts')
      .upsert(batch, { onConflict: 'user_id,email', ignoreDuplicates: true })
      .select('id')
    if (error && /page_id|submitted_at|PGRST204/.test(`${error.message} ${error.code ?? ''}`)) {
      extraSupported = false
      const retry = await supabase
        .from('email_contacts')
        .upsert(slice.map(stripExtra), { onConflict: 'user_id,email', ignoreDuplicates: true })
        .select('id')
      data = retry.data
      error = retry.error
    }
    if (error) console.error('[EmailContacts] UPSERT_FAIL', error.message)
    else inserted += data?.length ?? 0
  }
  return { inserted, skipped: payload.length - inserted }
}

interface CrmLeadForImport {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  email_opt_out?: boolean
  meta_page_id: string | null
  lead_created_time: string | null
}

/**
 * CRM lead'lerinden (e-postası olan, opt-out olmayan) kişi havuzuna aktar.
 * Hesap (meta_page_id) ve gerçek başvuru tarihi (lead_created_time) de taşınır.
 */
export async function importFromCrm(userId: string): Promise<{ inserted: number; skipped: number }> {
  if (!supabase) return { inserted: 0, skipped: 0 }
  const { data, error } = await supabase
    .from('crm_leads')
    .select('id, email, full_name, phone, email_opt_out, meta_page_id, lead_created_time')
    .eq('user_id', userId)
    .not('email', 'is', null)
  if (error) {
    console.error('[EmailContacts] CRM_IMPORT_FAIL', error.message)
    return { inserted: 0, skipped: 0 }
  }
  const rows: ContactInput[] = (data ?? [])
    .filter((l: CrmLeadForImport) => l.email && !l.email_opt_out)
    .map((l: CrmLeadForImport) => ({
      email: l.email as string,
      fullName: l.full_name,
      phone: l.phone,
      source: 'crm',
      crmLeadId: l.id,
      pageId: l.meta_page_id,
      submittedAt: l.lead_created_time,
    }))
  return upsertContacts(userId, rows, 'crm')
}

/**
 * Reklamdan düşen TEK bir CRM lead'ini kişi havuzuna otomatik ekler (webhook akışı).
 * Idempotent (UNIQUE user_id,email) — mevcut kişiyi ezmez. E-postası yoksa atlanır.
 */
export async function syncLeadToContact(
  userId: string,
  lead: { email?: string | null; fullName?: string | null; phone?: string | null; crmLeadId?: string | null; pageId?: string | null; submittedAt?: string | null },
): Promise<void> {
  if (!lead.email) return
  await upsertContacts(
    userId,
    [{
      email: lead.email,
      fullName: lead.fullName ?? null,
      phone: lead.phone ?? null,
      source: 'crm',
      crmLeadId: lead.crmLeadId ?? null,
      pageId: lead.pageId ?? null,
      submittedAt: lead.submittedAt ?? null,
    }],
    'crm',
  )
}

export async function deleteContact(id: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('email_contacts').delete().eq('id', id).eq('user_id', userId)
  return !error
}
