import 'server-only'
import { supabase } from '@/lib/supabase/client'

export type BriefScanStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed'

export interface SiteContentBriefRow {
  id: string
  user_id: string
  site_connection_id: string
  scan_status: BriefScanStatus
  company_name: string | null
  sector: string | null
  brand_tone: string | null
  target_audience: string | null
  products_or_services: string[]
  categories: string[]
  keyword_themes: string[]
  content_angles: string[]
  audience_pains: string[]
  summary_text: string | null
  last_error: string | null
  scanned_at: string | null
  created_at: string
  updated_at: string
}

export type BriefPatch = Partial<Omit<SiteContentBriefRow, 'id' | 'user_id' | 'site_connection_id' | 'created_at' | 'updated_at'>>

/**
 * Açık kolon listesi — `select('*')` KULLANMA. Yeni oluşturulan tablolarda bazı
 * PostgREST örneklerinin şema cache'i `*` genişletmesini boş döndürebiliyor
 * (kolonlar cache'e girene kadar), bu da satırı "yok" gibi gösterip upsert'i
 * sessizce bozuyordu. Açık kolonlar her zaman güvenli.
 */
const BRIEF_COLS =
  'id,user_id,site_connection_id,scan_status,company_name,sector,brand_tone,target_audience,products_or_services,categories,keyword_themes,content_angles,audience_pains,summary_text,last_error,scanned_at,created_at,updated_at'

/** Site bağlantısına ait brief (yoksa null). */
export async function getBriefByConnection(siteConnectionId: string): Promise<SiteContentBriefRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('site_content_briefs')
    .select(BRIEF_COLS)
    .eq('site_connection_id', siteConnectionId)
    .maybeSingle()
  if (error || !data) return null
  return data as SiteContentBriefRow
}

/**
 * Site başına tek brief upsert — native ON CONFLICT (site_connection_id).
 * Önce-oku-sonra-yaz YOK: tek atomik istek, hem ekleme hem güncelleme.
 * (Tablodaki UNIQUE(site_connection_id) indeksi conflict hedefi olarak kullanılır.)
 */
export async function upsertBrief(
  userId: string,
  siteConnectionId: string,
  patch: BriefPatch
): Promise<SiteContentBriefRow | null> {
  if (!supabase) return null
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('site_content_briefs')
    .upsert(
      { user_id: userId, site_connection_id: siteConnectionId, ...patch, updated_at: now },
      { onConflict: 'site_connection_id' }
    )
    .select(BRIEF_COLS)
    .single()
  if (error || !data) {
    console.error('[BriefStore] UPSERT_FAIL', error?.message)
    return null
  }
  return data as SiteContentBriefRow
}

/** Bayatlamış (scanned_at < cutoff) VEYA pending/failed brief'ler — aylık tazeleme için. */
export async function listStaleBriefs(cutoffIso: string): Promise<SiteContentBriefRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('site_content_briefs')
    .select(BRIEF_COLS)
    .or(`scanned_at.is.null,scanned_at.lt.${cutoffIso},scan_status.eq.failed`)
  if (error) {
    console.error('[BriefStore] LIST_STALE_FAIL', error.message)
    return []
  }
  return (data ?? []) as SiteContentBriefRow[]
}
