import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { ensureUniqueSubdomain } from './subdomain'
import {
  rowToWebsite,
  type Website,
  type WebsiteRow,
  type WebsiteDraftInput,
  type WebsitePatchInput,
  type ThemeTokens,
} from './types'

function requireClient() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return supabase
}

const DEFAULT_THEME: ThemeTokens = { primaryColor: null }

/** Kullanıcının tüm sitelerini (yeni → eski) döner. */
export async function listWebsites(userId: string): Promise<Website[]> {
  const db = requireClient()
  const { data, error } = await db
    .from('websites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as WebsiteRow[]).map(rowToWebsite)
}

/** Tek siteyi döner (sahiplik kontrolü: user_id eşleşmesi). */
export async function getWebsite(userId: string, id: string): Promise<Website | null> {
  const db = requireClient()
  const { data, error } = await db
    .from('websites')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? rowToWebsite(data as WebsiteRow) : null
}

/** Yeni taslak site oluşturur (status='draft'). Üretim/kredi bu adımda DEĞİL — Faz 1c. */
export async function createWebsite(userId: string, input: WebsiteDraftInput): Promise<Website> {
  const db = requireClient()
  const label = input.label?.trim() || 'Yeni Web Sitesi'
  const subdomain = await ensureUniqueSubdomain(label)
  const defaultLocale = input.defaultLocale || 'tr'
  const locales = input.locales?.length ? input.locales : [defaultLocale]
  const theme: ThemeTokens = { ...DEFAULT_THEME, ...(input.theme ?? {}) }

  const { data, error } = await db
    .from('websites')
    .insert({
      user_id: userId,
      label,
      subdomain,
      site_type: input.siteType ?? 'multipage',
      default_locale: defaultLocale,
      locales,
      category: input.category ?? null,
      status: 'draft',
      theme,
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToWebsite(data as WebsiteRow)
}

/** Siteyi günceller (yalnız sahibinin kaydında). */
export async function updateWebsite(
  userId: string,
  id: string,
  patch: WebsitePatchInput,
): Promise<Website | null> {
  const db = requireClient()
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.label !== undefined) row.label = patch.label.trim()
  if (patch.siteType !== undefined) row.site_type = patch.siteType
  if (patch.category !== undefined) row.category = patch.category
  if (patch.defaultLocale !== undefined) row.default_locale = patch.defaultLocale
  if (patch.locales !== undefined) row.locales = patch.locales
  if (patch.theme !== undefined) row.theme = patch.theme
  if (patch.status !== undefined) row.status = patch.status

  const { data, error } = await db
    .from('websites')
    .update(row)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data ? rowToWebsite(data as WebsiteRow) : null
}

/** Siteyi siler (cascade: pages + versions). Silinen satır 0 ise false. */
export async function deleteWebsite(userId: string, id: string): Promise<boolean> {
  const db = requireClient()
  const { data, error } = await db
    .from('websites')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
    .select('id')
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}
