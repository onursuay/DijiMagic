/* ──────────────────────────────────────────────────────────
   Supabase Env Resolution (A6 — tek nokta)

   Tüm server modülleri Supabase URL/anahtarını BURADAN çözer ki
   modüller arası "split-brain" (biri fbqr'a, diğeri omddq'ya
   yazma) tekrar oluşmasın.

   Sıra: SERVER-FIRST — SUPABASE_URL || NEXT_PUBLIC_SUPABASE_URL.
   Bu, ana yazma client'ı (lib/supabase/client.ts) ile aynı; kritik
   AI engine yazma yolu DAVRANIŞ DEĞİŞTİRMEZ.

   ÖNEMLİ (deploy sırası): Bu kod canonical env'i VARSAYAR. Bu branch
   prod'a çıkmadan ÖNCE Vercel'de SUPABASE_URL canonical projeye
   (omddq) eşitlenmeli — aksi halde server-first sıra bazı modülleri
   eski/ölü SUPABASE_URL'e yönlendirir. Ayrıntı: docs/CHANGELOG.md A6.
   ────────────────────────────────────────────────────────── */

export function resolveSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
}

/** Servis (write) anahtarı — SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_ROLE_KEY. */
export function resolveSupabaseServiceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
}

/** Anon (RLS-bound read) anahtarı. */
export function resolveSupabaseAnonKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

function projectRef(url: string): string {
  const m = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)
  return m ? m[1] : url
}

let _warned = false

/**
 * SUPABASE_URL ile NEXT_PUBLIC_SUPABASE_URL FARKLI projelere işaret
 * ediyorsa bir kez uyarır (split-brain guard). Crash ETMEZ — yalnızca
 * server yazımı ile UI okumasının farklı DB'ye gitme riskini görünür kılar.
 */
export function warnIfSupabaseSplitBrain(): void {
  if (_warned) return
  _warned = true
  const server = process.env.SUPABASE_URL
  const pub = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (server && pub && projectRef(server) !== projectRef(pub)) {
    console.warn(
      `[Supabase][SPLIT-BRAIN] SUPABASE_URL (${projectRef(server)}) ile ` +
        `NEXT_PUBLIC_SUPABASE_URL (${projectRef(pub)}) FARKLI Supabase projelerine işaret ediyor. ` +
        `Server yazımları ile UI okumaları farklı DB'ye gidebilir — ikisini de tek canonical projeye eşitleyin.`,
    )
  }
}
