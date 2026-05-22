/* ──────────────────────────────────────────────────────────
   Registered Ad Accounts Store (Madde 2 — çoklu reklam hesabı)
   Table: user_registered_ad_accounts

   Kullanıcının planına eklediği (faturalanan) reklam hesabı kümesi.
   Aktif hesap meta_connections / google_ads_connections içinde kalır;
   bu tablo kullanıcının arasında geçiş yapabileceği izinli kümedir.

   Limit kaynağı: subscriptions.ad_accounts (TOPLAM — Meta + Google birlikte).
   Owner / süper admin: sınırsız (billing owner bypass ile aynı allowlist).

   NOT: Bu modül Faz 2.0'da yalnız tanımlanır; API/UI guard'ları (Faz 2.1+)
   bunu kullanacak. Hiçbir mevcut akış henüz çağırmaz → sıfır davranış değişikliği.
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'
import { getSubscription } from '@/lib/billing/db'
import { isSuperAdminEmail } from '@/lib/admin/superAdmin'

export type AdPlatform = 'meta' | 'google'

export interface RegisteredAdAccount {
  id?: string
  user_id: string
  platform: AdPlatform
  account_id: string
  account_name: string | null
  login_customer_id: string | null
  created_at?: string
}

/** Abonelik satırı yokken (deneme/temel) varsayılan dahil hesap adedi. */
export const DEFAULT_ACCOUNT_LIMIT = 2

/** userId → owner mu? (signups.email + paylaşılan allowlist). */
async function isOwnerById(userId: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.from('signups').select('email').eq('id', userId).single()
  return isSuperAdminEmail(data?.email ?? null)
}

/**
 * Kullanıcının kaç reklam hesabına hakkı var (toplam, platformdan bağımsız).
 * Owner sınırsız (Infinity); aksi halde subscriptions.ad_accounts, satır yoksa
 * DEFAULT_ACCOUNT_LIMIT.
 */
export async function resolveAccountLimit(userId: string): Promise<number> {
  if (await isOwnerById(userId)) return Number.POSITIVE_INFINITY
  const sub = await getSubscription(userId)
  return sub?.ad_accounts ?? DEFAULT_ACCOUNT_LIMIT
}

/** Kullanıcının kayıtlı hesaplarını (tüm platformlar) eklenme sırasına göre döndürür. */
export async function listRegisteredAccounts(userId: string): Promise<RegisteredAdAccount[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('user_registered_ad_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as RegisteredAdAccount[]
}

/** Kayıtlı toplam hesap sayısı (limit kontrolü için). */
export async function countRegisteredAccounts(userId: string): Promise<number> {
  if (!supabase) return 0
  const { count } = await supabase
    .from('user_registered_ad_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count ?? 0
}

/** Belirli bir hesap kullanıcının kümesinde kayıtlı mı? */
export async function isAccountRegistered(
  userId: string,
  platform: AdPlatform,
  accountId: string,
): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase
    .from('user_registered_ad_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('account_id', accountId)
    .maybeSingle()
  return !!data
}

export interface AddAccountInput {
  platform: AdPlatform
  account_id: string
  account_name?: string | null
  login_customer_id?: string | null
}

export type AddAccountResult =
  | { ok: true; account: RegisteredAdAccount; alreadyRegistered: boolean }
  | { ok: false; error: 'limit_reached'; count: number; limit: number }
  | { ok: false; error: 'db_error'; message: string }

/**
 * Hesabı kayıtlı kümeye ekler, plan limitini zorlar.
 * - Zaten kayıtlıysa slot tüketmez (idempotent).
 * - Limit doluysa `limit_reached` döner (UI AccessRequiredModal gösterir).
 */
export async function addRegisteredAccount(
  userId: string,
  input: AddAccountInput,
): Promise<AddAccountResult> {
  if (!supabase) return { ok: false, error: 'db_error', message: 'Supabase yapılandırılmamış' }

  const existing = await supabase
    .from('user_registered_ad_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', input.platform)
    .eq('account_id', input.account_id)
    .maybeSingle()
  if (existing.data) {
    return { ok: true, account: existing.data as RegisteredAdAccount, alreadyRegistered: true }
  }

  const [limit, count] = await Promise.all([
    resolveAccountLimit(userId),
    countRegisteredAccounts(userId),
  ])
  if (count >= limit) return { ok: false, error: 'limit_reached', count, limit }

  const { data, error } = await supabase
    .from('user_registered_ad_accounts')
    .insert({
      user_id: userId,
      platform: input.platform,
      account_id: input.account_id,
      account_name: input.account_name ?? null,
      login_customer_id: input.login_customer_id ?? null,
    })
    .select()
    .single()
  if (error) return { ok: false, error: 'db_error', message: error.message }
  return { ok: true, account: data as RegisteredAdAccount, alreadyRegistered: false }
}

/** Hesabı kayıtlı kümeden çıkarır. */
export async function removeRegisteredAccount(
  userId: string,
  platform: AdPlatform,
  accountId: string,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('user_registered_ad_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('account_id', accountId)
  return !error
}
