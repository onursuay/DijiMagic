import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseUrl, resolveSupabaseServiceKey, warnIfSupabaseSplitBrain } from './env'

const supabaseUrl = resolveSupabaseUrl()
const supabaseKey = resolveSupabaseServiceKey()

// A6 — server yazımı ile UI okuması farklı projeye gidiyorsa uyar (crash etmez).
warnIfSupabaseSplitBrain()

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY not set — database features disabled')
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null
