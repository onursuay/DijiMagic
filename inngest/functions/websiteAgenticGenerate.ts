/* ──────────────────────────────────────────────────────────
   Inngest Function: website/generate.agentic (Faz 1.3)

   Agentic Website Generator orkestratörü.

   İki yol:
     A) Dev-fallback  — SANDBOX_URL/SANDBOX_HMAC_SECRET yokken
        mevcut senkron motor (generateHtmlSite) inline çalıştırılır.
        Faz 1'de WEBSITE_AGENTIC bayrağı açıkken KEY GEREKTİRMEDEN
        uçtan uca test edilebilir.

     B) Prod-sandbox  — Faz 2: sandbox dispatch → waitForEvent (12 dk)
        → persist. Bu yol şimdi iskelettir; Faz 2'de doldurulur.

   İdempotency: tüm yan-etkili bloklar step.run içinde → Inngest
   her adımı event başına tam bir kez memoize eder (retry güvenli).

   Hata/timeout: markJobFailed + refundCreditsServer (çift persist yok).
   ────────────────────────────────────────────────────────── */

import { inngest } from '../client'
import {
  updateJobStatus,
  appendJobLog,
  markJobComplete,
  markJobFailed,
  getWebsiteGenJob,
} from '@/lib/website/genJobStore'
import { getWebsite } from '@/lib/website/store'
import { persistGeneratedSite } from '@/lib/website/persistGeneratedSite'
import { gateSiteHtml } from '@/lib/website/codegen/renderGate.mjs'
import { generateHtmlSite } from '@/lib/website/codegen/generateHtmlSite'
import { refundCreditsServer } from '@/lib/billing/db'

// ---------------------------------------------------------------------------
// Event payload type
// ---------------------------------------------------------------------------

interface WebsiteAgenticGenerateEventData {
  jobId: string
  websiteId: string
  userId: string
  brief: string
  locales: string[]
  isRevision?: boolean
  creditSpent?: number
}

// ---------------------------------------------------------------------------
// Helper — sandbox yapılandırılmış mı?
// ---------------------------------------------------------------------------

function isSandboxConfigured(): boolean {
  return Boolean(process.env.SANDBOX_URL && process.env.SANDBOX_HMAC_SECRET)
}

// ---------------------------------------------------------------------------
// Inngest function (2-ARG form — triggers config içinde)
// ---------------------------------------------------------------------------

export const websiteAgenticGenerate = inngest.createFunction(
  {
    id: 'website-agentic-generate',
    name: 'Web Sitesi — Agentic Üretim',
    concurrency: [{ limit: 5 }, { key: 'event.data.userId', limit: 1 }],
    retries: 2,
    triggers: [{ event: 'website/generate.agentic' }],
  },
  async ({ event, step, logger }) => {
    const {
      jobId,
      websiteId,
      userId,
      brief,
      locales,
      isRevision = false,
      creditSpent = 0,
    } = event.data as WebsiteAgenticGenerateEventData

    // -----------------------------------------------------------------------
    // Adım 1 — İş başlatıldı (idempotent step)
    // -----------------------------------------------------------------------
    await step.run('mark-running', async () => {
      await updateJobStatus(jobId, 'running')
      await appendJobLog(jobId, 'design_system', 5, 'Tasarım sistemi kuruluyor')
      return { ok: true }
    })

    // -----------------------------------------------------------------------
    // Yol A — Dev-fallback (sandbox YOK → mevcut senkron motor inline)
    // -----------------------------------------------------------------------
    if (!isSandboxConfigured()) {
      await step.run('dev-fallback-generate', async () => {
        const site = await getWebsite(userId, websiteId)
        if (!site) {
          await markJobFailed(jobId, 'website_not_found')
          if (creditSpent > 0) {
            await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
          }
          return { ok: false }
        }

        await appendJobLog(jobId, 'building_page', 40, 'Sayfa inşa ediliyor (dev-fallback)')

        const result = await generateHtmlSite(userId, site, { instructions: brief })

        if (!result.ok) {
          await markJobFailed(jobId, `generate_failed:${result.reason}`)
          if (creditSpent > 0) {
            await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
          }
          return { ok: false }
        }

        // renderGate — SON OTORİTE
        const gated = gateSiteHtml(result.page.html ?? '')
        if (!gated.ok) {
          await markJobFailed(jobId, `gate_failed:${gated.reason}`)
          if (creditSpent > 0) {
            await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
          }
          return { ok: false }
        }

        // İdempotent persist (step.run memoize eder — retry'da çift yazılmaz)
        await persistGeneratedSite(userId, site, result, isRevision, creditSpent)
        await markJobComplete(jobId, gated.html, result.designVars)
        return { ok: true }
      })

      logger.info(`[website-agentic] dev-fallback tamamlandı: ${jobId}`)
      return { ok: true, jobId, mode: 'dev-fallback' }
    }

    // -----------------------------------------------------------------------
    // Yol B — Prod-sandbox (Faz 2 iskeleti)
    // -----------------------------------------------------------------------
    await step.run('dispatch-sandbox', async () => {
      await appendJobLog(jobId, 'building_page', 15, 'Sandbox işçisi başlatılıyor')
      // FAZ 2: POST {SANDBOX_URL}/run (HMAC imzalı brand asset URL'leri ile) → 202
      // Şimdilik boş iskelet — Faz 2'de doldurulur.
      return { ok: true }
    })

    const done = await step.waitForEvent('await-sandbox', {
      event: 'website/generate.sandbox-done',
      timeout: '12m',
      match: 'data.jobId',
    })

    if (!done) {
      // Timeout: kredi iade + iş başarısız işaretle
      await step.run('handle-timeout', async () => {
        await markJobFailed(jobId, 'sandbox_timeout')
        if (creditSpent > 0) {
          await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
        }
        await updateJobStatus(jobId, 'timeout')
        return { ok: false }
      })
      return { ok: false, jobId, reason: 'timeout' }
    }

    // Sandbox tamamlandı — persist (idempotent step)
    await step.run('persist-result', async () => {
      const job = await getWebsiteGenJob(jobId)
      const site = await getWebsite(userId, websiteId)

      if (!site || !job?.generatedHtml) {
        throw new Error('persist-missing-input')
      }

      // renderGate — SON OTORİTE (sandbox çıktısı da gate'ten geçer)
      const gated = gateSiteHtml(job.generatedHtml)
      if (!gated.ok) {
        await markJobFailed(jobId, `gate_failed:${gated.reason}`)
        if (creditSpent > 0) {
          await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
        }
        return { ok: false }
      }

      // Sandbox tek home sayfası sözleşmesiyle persist edilir.
      // sections: [] açıkça verilir — WebsitePageInput.sections zorunludur;
      // boş dizi geçerlidir (sunum format==='html' iken html'i kullanır).
      const homePage = {
        locale: locales[0] ?? 'tr',
        slug: '/',
        pageRole: 'home' as const,
        sections: [],
        html: gated.html,
        format: 'html' as const,
      }
      const result = {
        ok: true as const,
        page: homePage,
        pages: [homePage],
        designVars: job.designVars ?? {},
      }

      await persistGeneratedSite(userId, site, result, isRevision, creditSpent)
      await markJobComplete(jobId, gated.html, job.designVars ?? {})
      return { ok: true }
    })

    logger.info(`[website-agentic] tamamlandı: ${jobId}`)
    return { ok: true, jobId }
  },
)
