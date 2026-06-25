/* ──────────────────────────────────────────────────────────
   Inngest Function: dijialgoritma/improvements.user

   Per-Ad Improvement Cards (Faz 2). Tek kullanıcı için:
     1. fetch      — aktif Meta + Google reklamları (full creative dahil)
     2. reconcile  — lifecycle: pasif reklam kartlarını auto-cancel,
                     creative değişen pending kartları supersede,
                     üretilmesi gereken reklamları seç (refresh policy)
     3. submit     — gereken reklamlar için per-ad Batch API isteği
     4. poll       — batch ended olana kadar bekle
     5. retrieve   — sonuçları topla
     6. persist    — improve olanları ai_ad_improvements'a pending yaz

   Lifecycle (auto-cancel/supersede) burada generation'dan ÖNCE,
   tek atomik scan içinde yapılır — ayrı racing worker yerine güvenli.

   ai_suggestions (hesap-geneli) akışı bundan ETKİLENMEZ — paraleldir.
   ────────────────────────────────────────────────────────── */

import { inngest } from '../client'
import { getAnthropicClient } from '@/lib/anthropic/client'
import { gatherUserScanInputs, type UserScanInputs } from '@/lib/dijimagic/ai/scanUser'
import { buildPerAdBatchRequestParams, parsePerAdBatchResult } from '@/lib/dijimagic/ai/perAdAgent'
import type { PerAdContext } from '@/lib/dijimagic/ai/perAdPrompt'
import {
  listRecentImprovements,
  cancelImprovement,
  supersedeImprovement,
  insertImprovement,
} from '@/lib/dijimagic/ai/improvementStore'
import type { AiPlatform } from '@/lib/dijimagic/ai/types'
import type { AdInsight } from '@/lib/dijimagic/analysisTypes'

const POLL_INTERVAL = '60s'
const MAX_POLLS = 1440 // ~24h (Anthropic batch SLA)

interface ActiveAd {
  platform: 'meta' | 'google'
  aiPlatform: AiPlatform
  ad: AdInsight
  campaignName: string
  campaignObjective: string
  adsetName: string
  adsetOptimizationGoal?: string
  destinationType?: string
  accountId: string
  creativeHash: string
  key: string
}

function flattenActiveAds(scanInputs: UserScanInputs): ActiveAd[] {
  const out: ActiveAd[] = []
  for (const data of [scanInputs.meta, scanInputs.google]) {
    if (!data.connected) continue
    const platform: 'meta' | 'google' = data.platform === 'Meta' ? 'meta' : 'google'
    for (const c of data.campaigns) {
      for (const as of c.adsets) {
        for (const ad of as.ads) {
          if (!ad.id) continue
          out.push({
            platform,
            aiPlatform: data.platform,
            ad,
            campaignName: c.campaignName,
            campaignObjective: c.objective,
            adsetName: as.name,
            adsetOptimizationGoal: as.optimizationGoal,
            destinationType: as.destinationType,
            accountId: data.accountId ?? '',
            creativeHash: ad.creativeHash ?? '',
            key: `${platform}:${ad.id}`,
          })
        }
      }
    }
  }
  return out
}

function sanitizeCustomId(platform: string, adId: string): string {
  return `${platform}_${adId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
}

export const dijialgoritmaPerAdImprovements = inngest.createFunction(
  {
    id: 'dijialgoritma-per-ad-improvements',
    name: 'DijiAlgoritma — Per-Ad Improvement Cards',
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: 'dijialgoritma/improvements.user' }],
  },
  async ({ event, step, logger }) => {
    const userId = String(event.data?.userId ?? '')
    if (!userId) throw new Error('userId zorunlu')

    // 1) Fetch aktif reklamlar + bağlam
    const scanInputs = await step.run('fetch-user-data', async () => gatherUserScanInputs(userId))
    const activeAds = flattenActiveAds(scanInputs)

    // 2) Reconcile (lifecycle) — auto-cancel + supersede + generation planı
    const plan = await step.run('reconcile-lifecycle', async () => {
      const recent = await listRecentImprovements(userId, 500)
      const activeKeys = new Set(activeAds.map((a) => a.key))
      const latestByKey = new Map<string, (typeof recent)[number]>()
      for (const card of recent) {
        const key = `${card.source_platform}:${card.source_ad_id}`
        if (!latestByKey.has(key)) latestByKey.set(key, card) // desc → ilk görülen = en son
      }

      // auto-cancel: pasif reklamın pending kartı
      let cancelled = 0
      for (const card of recent) {
        if (card.status !== 'pending') continue
        const key = `${card.source_platform}:${card.source_ad_id}`
        if (!activeKeys.has(key)) {
          await cancelImprovement(card.id, 'Otomatik iptal: kaynak reklam aktif değil')
          cancelled++
        }
      }

      // generation planı (refresh policy — karar 2)
      const generateKeys: string[] = []
      let superseded = 0
      for (const a of activeAds) {
        const latest = latestByKey.get(a.key)
        if (!latest) { generateKeys.push(a.key); continue }
        if (latest.status === 'pending') {
          if (latest.source_creative_hash && a.creativeHash && latest.source_creative_hash !== a.creativeHash) {
            await supersedeImprovement(latest.id)
            superseded++
            generateKeys.push(a.key)
          }
          // değişmemiş pending → skip
        } else if (latest.status === 'cancelled' || latest.status === 'superseded') {
          // auto-cancel sonrası tekrar aktif / supersede sonrası eksik → yeni kart
          generateKeys.push(a.key)
        }
        // approved / applied / rejected → ASLA regenerate (skip)
      }
      return { cancelled, superseded, generateKeys }
    })

    const toGenerate = activeAds.filter((a) => plan.generateKeys.includes(a.key))
    logger.info(`[improvements.user] ${userId}: aktif=${activeAds.length} üretilecek=${toGenerate.length} iptal=${plan.cancelled} superseded=${plan.superseded}`)

    if (toGenerate.length === 0) {
      return { userId, generated: 0, cancelled: plan.cancelled, superseded: plan.superseded, reason: 'nothing-to-generate' }
    }

    // 3) Per-ad batch requests
    const customToAd = new Map<string, ActiveAd>()
    const batchRequests: Array<{ custom_id: string; params: ReturnType<typeof buildPerAdBatchRequestParams> }> = []
    for (const a of toGenerate) {
      const customId = sanitizeCustomId(a.platform, a.ad.id)
      if (customToAd.has(customId)) continue
      customToAd.set(customId, a)
      const ctx: PerAdContext = {
        platform: a.aiPlatform,
        accountId: a.accountId,
        ad: a.ad,
        campaignName: a.campaignName,
        campaignObjective: a.campaignObjective,
        adsetName: a.adsetName,
        adsetOptimizationGoal: a.adsetOptimizationGoal,
        destinationType: a.destinationType,
        industry: scanInputs.industry,
      }
      const competitorContext = a.aiPlatform === 'Meta' ? scanInputs.competitorContext.meta : scanInputs.competitorContext.google
      batchRequests.push({
        custom_id: customId,
        params: buildPerAdBatchRequestParams({ ctx, businessContext: scanInputs.businessContext, competitorContext }),
      })
    }

    // 4) Submit batch
    const batch = await step.run('submit-batch', async () => {
      const client = getAnthropicClient()
      const b = await client.messages.batches.create({ requests: batchRequests as any })
      return { id: b.id }
    })
    logger.info(`[improvements.user] ${userId}: batch submitted id=${batch.id} requests=${batchRequests.length}`)

    // 5) Poll until ended
    let ended = false
    for (let i = 0; i < MAX_POLLS; i++) {
      await step.sleep(`wait-poll-${i}`, POLL_INTERVAL)
      const status = await step.run(`poll-${i}`, async () => {
        const client = getAnthropicClient()
        const b = await client.messages.batches.retrieve(batch.id)
        return b.processing_status
      })
      if (status === 'ended') { ended = true; break }
    }
    if (!ended) throw new Error(`Batch ${batch.id} 24h içinde tamamlanmadı`)

    // 6) Retrieve + persist
    const persisted = await step.run('retrieve-and-persist', async () => {
      const client = getAnthropicClient()
      const stream = await client.messages.batches.results(batch.id)
      let created = 0, alreadyStrong = 0, failed = 0
      for await (const r of stream) {
        const a = customToAd.get(r.custom_id)
        if (!a) continue
        if (r.result?.type !== 'succeeded') { failed++; continue }
        const model = batchRequests.find((b) => b.custom_id === r.custom_id)?.params.model ?? 'unknown'
        const { improvement } = parsePerAdBatchResult(r.result.message as any, model, 0, a.ad.id, a.platform)
        if (!improvement || improvement.keep_or_improve !== 'improve' || !improvement.improvement_payload.ad_spec) {
          alreadyStrong++
          continue
        }
        const res = await insertImprovement({
          user_id: userId,
          source_platform: a.platform,
          source_ad_id: a.ad.id,
          source_ad_name: a.ad.name,
          source_campaign_id: null,
          source_campaign_name: a.campaignName,
          source_ad_status_snapshot: a.ad.status,
          source_creative_hash: a.creativeHash || null,
          improvement_payload: improvement.improvement_payload,
          confidence: improvement.improvement_payload.confidence,
          publish_mode: a.platform === 'meta' ? 'auto' : 'manual_publish',
          model,
        })
        if (res.ok) created++
      }
      return { created, alreadyStrong, failed }
    })

    return {
      userId,
      batchId: batch.id,
      generated: persisted.created,
      alreadyStrong: persisted.alreadyStrong,
      failed: persisted.failed,
      cancelled: plan.cancelled,
      superseded: plan.superseded,
    }
  },
)
