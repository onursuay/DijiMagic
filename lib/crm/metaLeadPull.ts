import 'server-only'
import { MetaGraphClient } from '@/lib/meta/client'
import { getMetaConnection } from '@/lib/metaConnectionStore'
import { getPageAccessToken } from '@/lib/meta/pageToken'
import { listSubscriptions } from './pageSubscriptionStore'
import { upsertLead } from './leadStore'
import { parseLeadFields } from './leadFields'

/**
 * CRM lead PULL akışı (webhook'a alternatif/yedek).
 *
 * Webhook gerçek-zamanlı teslimat için `pages_manage_metadata` gerektirir
 * (subscribed_apps). Bu izin yokken bile, `leads_retrieval` ile formlardan
 * lead'leri ÇEKİP CRM'e yazabiliriz. Manuel "Lead'leri Çek" butonu ve cron
 * bu fonksiyonu çağırır. Idempotent (upsert leadgen_id UNIQUE) — tekrar çekmek
 * mevcut lead'leri/kullanıcı işaretlerini ezmez.
 *
 * Meta entegrasyonuna dokunulmaz — yalnız mevcut client + pageToken reuse.
 */

interface LeadgenForm { id: string; name?: string; leads_count?: number }
interface RawLead {
  id: string
  created_time?: string
  field_data?: Array<{ name?: string; values?: string[] }>
  ad_id?: string
  campaign_name?: string
}

export interface PullResult {
  ok: boolean
  reason?: 'meta_not_connected' | 'no_pages'
  pages: number
  processed: number
  inserted: number
}

export async function pullLeadsForUser(
  userId: string,
  opts: { maxPagesPerForm?: number; startedAt?: number; budgetMs?: number } = {},
): Promise<PullResult> {
  const subs = await listSubscriptions(userId)
  if (subs.length === 0) return { ok: true, reason: 'no_pages', pages: 0, processed: 0, inserted: 0 }

  const conn = await getMetaConnection(userId)
  if (!conn?.accessToken) return { ok: false, reason: 'meta_not_connected', pages: subs.length, processed: 0, inserted: 0 }

  const maxPages = opts.maxPagesPerForm ?? 3
  const startedAt = opts.startedAt ?? Date.now()
  const budgetMs = opts.budgetMs ?? 45_000

  let processed = 0
  let inserted = 0

  for (const sub of subs) {
    if (Date.now() - startedAt > budgetMs) break

    let pageToken: string
    try {
      pageToken = (await getPageAccessToken(conn.accessToken, sub.page_id)).pageToken
    } catch {
      continue
    }
    const client = new MetaGraphClient({ accessToken: pageToken, maxRetries: 1, timeout: 10_000 })

    const formsRes = await client.get<{ data?: LeadgenForm[] }>(`/${sub.page_id}/leadgen_forms`, {
      fields: 'id,name,leads_count',
      limit: '100',
    })
    const forms = (formsRes.ok ? formsRes.data?.data ?? [] : []).filter((f) => Number(f.leads_count) > 0)

    for (const form of forms) {
      if (Date.now() - startedAt > budgetMs) break
      let after: string | undefined

      for (let page = 0; page < maxPages; page++) {
        if (Date.now() - startedAt > budgetMs) break
        const params: Record<string, string> = {
          fields: 'id,created_time,field_data,ad_id,campaign_name',
          limit: '100',
        }
        if (after) params.after = after

        const res = await client.get<{
          data?: RawLead[]
          paging?: { cursors?: { after?: string }; next?: string }
        }>(`/${form.id}/leads`, params)
        if (!res.ok) break

        for (const ld of res.data?.data ?? []) {
          const p = parseLeadFields(ld.field_data)
          const row = await upsertLead({
            userId,
            metaLeadgenId: ld.id,
            metaFormId: form.id,
            metaPageId: sub.page_id,
            formName: form.name ?? null,
            adId: ld.ad_id ?? null,
            campaignName: ld.campaign_name ?? null,
            fullName: p.fullName,
            email: p.email,
            phone: p.phone,
            rawFieldData: ld.field_data ?? [],
            leadCreatedTime: ld.created_time ?? null,
          })
          processed++
          if (row) inserted++ // upsert ignoreDuplicates: yalnız YENİ kayıt row döner
        }

        after = res.data?.paging?.cursors?.after
        if (!res.data?.paging?.next || !after) break
      }
    }
  }

  return { ok: true, pages: subs.length, processed, inserted }
}
