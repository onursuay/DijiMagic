/**
 * Signup Blocklist — server-side yardımcı fonksiyonlar.
 *
 * signup_blocklist tablosu: block_type (user|email|domain|ip), value, active.
 * Normal kullanıcılara erişim kapalı; yalnızca admin endpoint'leri ve guard'lar kullanır.
 */
import 'server-only'
import { supabase } from '@/lib/supabase/client'

export type BlockType = 'user' | 'email' | 'domain' | 'ip'

export interface BlockEntry {
  block_type: BlockType
  value: string
  signup_id?: string | null
  reason?: string | null
  created_by: string
  source_ip?: string | null
  metadata?: Record<string, unknown> | null
}

export interface BlocklistCheckResult {
  blocked: boolean
  reasons: string[]
}

/**
 * Verilen değerler için aktif blocklist kaydı var mı kontrol eder.
 * Birden fazla değer/tür gönderilebilir; herhangi biri aktif blocklist'teyse blocked=true döner.
 */
export async function checkBlocklist(
  checks: Array<{ type: BlockType; value: string }>,
): Promise<BlocklistCheckResult> {
  if (!supabase || checks.length === 0) return { blocked: false, reasons: [] }

  const reasons: string[] = []
  for (const { type, value } of checks) {
    if (!value) continue
    const { data, error } = await supabase
      .from('signup_blocklist')
      .select('id, block_type')
      .eq('block_type', type)
      .eq('active', true)
      .ilike('value', value.toLowerCase())
      .limit(1)

    if (!error && data && data.length > 0) {
      reasons.push(type)
    }
  }

  return { blocked: reasons.length > 0, reasons }
}

/**
 * Bir veya birden fazla blocklist kaydı ekler.
 * Partial unique index (block_type + lower(value) WHERE active = true) sayesinde
 * duplicate girişler DB seviyesinde reddedilir.
 */
export async function addToBlocklist(entries: BlockEntry[]): Promise<void> {
  if (!supabase || entries.length === 0) return

  const rows = entries.map((e) => ({
    block_type: e.block_type,
    value: e.value.trim().toLowerCase(),
    signup_id: e.signup_id ?? null,
    reason: e.reason ?? null,
    created_by: e.created_by,
    source_ip: e.source_ip ?? null,
    metadata: e.metadata ?? null,
    active: true,
  }))

  // ON CONFLICT DO NOTHING — duplicate girişi sessizce atla.
  const { error } = await supabase
    .from('signup_blocklist')
    .upsert(rows, { onConflict: 'block_type,value', ignoreDuplicates: true })

  if (error) {
    console.error('[blocklist] addToBlocklist error:', error.message)
  }
}

/**
 * Email adresinden domain çıkarır.
 * "user@example.com" → "example.com"
 */
export function extractDomain(email: string): string {
  const parts = email.toLowerCase().split('@')
  return parts.length === 2 ? parts[1] : ''
}
