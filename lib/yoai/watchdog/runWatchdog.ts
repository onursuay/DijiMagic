/* ──────────────────────────────────────────────────────────
   Erken Uyarı — Orkestratör (kullanıcı başına tarama)

   Akış (kullanıcı için):
     1. Önceki pending wd_* uyarılarını superseded yap (AI uyarılarına DOKUNMAZ;
        yalnız 'wd_' önekli kendi uyarılarını temizler → çözülenler kaybolur,
        sürenler tazelenir).
     2. Meta + Google nöbetçilerini paralel çalıştır.
     3. Bulguları (hesap, tür) bazında grupla → tek anlamlı uyarı (gürültü yok).
     4. account_alerts'e yaz.
     5. Bulgu varsa kullanıcıya tek e-posta özeti gönder.

   Deterministik + salt-okuma tarama → CANLI reklamlara hiç dokunmaz.
   ────────────────────────────────────────────────────────── */

import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { insertAccountAlert } from '@/lib/yoai/ai/hierarchicalStore'
import { runMetaWatchdog } from './metaWatchdog'
import { runGoogleWatchdog } from './googleWatchdog'
import { sendWatchdogDigest } from './notify'
import type { WatchdogFinding, UserWatchdogResult } from './types'

function newRunId(): string {
  try { return (globalThis.crypto as { randomUUID?: () => string })?.randomUUID?.() ?? `wd-${Date.now()}` }
  catch { return `wd-${Date.now()}` }
}

/** Önceki pending Erken Uyarı (wd_*) uyarılarını superseded yap — AI uyarılarına dokunmaz. */
async function supersedePendingWatchdog(userId: string): Promise<void> {
  if (!supabase) return
  try {
    await supabase.from('account_alerts')
      .update({ status: 'superseded', decided_by: 'erken-uyari', decided_at: new Date().toISOString() })
      .eq('user_id', userId).eq('status', 'pending').like('alert_type', 'wd_%')
  } catch (e) {
    console.error('[ErkenUyari] supersede wd alerts error:', e instanceof Error ? e.message : e)
  }
}

/** Bulguları (accountId, type) bazında tek uyarıya indirger; entity detayını payload'da tutar. */
function aggregate(findings: WatchdogFinding[]): WatchdogFinding[] {
  const groups = new Map<string, WatchdogFinding[]>()
  for (const f of findings) {
    const key = `${f.accountId}::${f.type}`
    const arr = groups.get(key); if (arr) arr.push(f); else groups.set(key, [f])
  }
  const merged: WatchdogFinding[] = []
  for (const [, arr] of groups) {
    if (arr.length === 1) { merged.push(arr[0]); continue }
    const head = arr[0]
    const names = arr.map((x) => x.entityName).filter(Boolean) as string[]
    merged.push({
      ...head,
      entityId: null,
      entityName: `${arr.length} öğe`,
      title: head.title.replace(/ — .*$/, '') + ` — ${arr.length} öğe (${head.accountName})`,
      body: `${arr.length} öğe etkilendi: ${names.slice(0, 8).join(', ')}${names.length > 8 ? '…' : ''}. ${head.body}`,
      evidence: { count: arr.length, entities: arr.map((x) => ({ id: x.entityId, name: x.entityName, ...x.evidence })) },
    })
  }
  return merged
}

export interface RunWatchdogOptions {
  /** false ise e-posta gönderme (yalnız alert yaz). Default true. */
  sendEmail?: boolean
}

/** Tek kullanıcı için tüm hesapları tara, uyarıları yaz, e-posta gönder. */
export async function runWatchdogForUser(userId: string, opts: RunWatchdogOptions = {}): Promise<UserWatchdogResult> {
  const runId = newRunId()
  const errors: string[] = []

  await supersedePendingWatchdog(userId)

  const [meta, google] = await Promise.all([
    runMetaWatchdog(userId).catch((e) => ({ findings: [], scanned: 0, skipped: 0, errors: [`meta_fatal:${e instanceof Error ? e.message : e}`] })),
    runGoogleWatchdog(userId).catch((e) => ({ findings: [], scanned: 0, skipped: 0, errors: [`google_fatal:${e instanceof Error ? e.message : e}`] })),
  ])
  errors.push(...meta.errors, ...google.errors)

  const findings = aggregate([...meta.findings, ...google.findings])

  let alertsWritten = 0
  for (const f of findings) {
    const res = await insertAccountAlert({
      user_id: userId,
      source_platform: f.platform,
      account_id: f.accountId,
      business_key: `${f.platform}:${f.accountId.replace(/^act_/, '')}`,
      alert_type: f.type,
      severity: f.severity,
      title: f.title,
      body: f.body,
      recommended_action: f.recommendedAction,
      alert_payload: { level: f.level, entityId: f.entityId, entityName: f.entityName, accountName: f.accountName, ...f.evidence },
      confidence: 95, // deterministik tespit → yüksek güven
      model: 'erken-uyari/rules@v1',
      run_id: runId,
    })
    if (res.ok) alertsWritten++
  }

  if (opts.sendEmail !== false) {
    try { await sendWatchdogDigest(userId, findings) }
    catch (e) { errors.push(`email:${e instanceof Error ? e.message : e}`) }
  }

  return {
    userId,
    accountsScanned: meta.scanned + google.scanned,
    accountsSkipped: meta.skipped + google.skipped,
    findings,
    alertsWritten,
    errors,
  }
}
