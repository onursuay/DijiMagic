/* ──────────────────────────────────────────────────────────
   Inngest Function: website/generate.agentic (Faz 2 Stage B T4)

   Agentic Website Generator orkestratörü.

   İki yol:
     A) Dev-fallback  — DAYTONA_API_KEY / WEBSITE_SANDBOX_HMAC_SECRET /
        WEBSITE_CALLBACK_BASE eksikken mevcut senkron motor (generateHtmlSite)
        inline çalıştırılır. WEBSITE_AGENTIC bayrağı açıkken KEY GEREKTİRMEDEN
        uçtan uca test edilebilir.

     B) Prod-sandbox  — Faz 2 Stage B: sandbox dispatch → waitForEvent (12 dk)
        → persist → cleanup. Daytona konfigürasyonu tam olduğunda bu yol aktif.

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
  persistSandboxRef,
  getSandboxRef,
} from '@/lib/website/genJobStore'
import { getWebsite } from '@/lib/website/store'
import { persistGeneratedSite } from '@/lib/website/persistGeneratedSite'
import { gateSiteHtml } from '@/lib/website/codegen/renderGate.mjs'
import { generateHtmlSite } from '@/lib/website/codegen/generateHtmlSite'
import { runAgenticBuild, deleteSandbox } from '@/lib/website/codegen/agentic/runAgenticBuild'
import { getProfileByUserId } from '@/lib/dijimagic/businessProfileStore'
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
// Daytona SDK env'den DAYTONA_API_KEY'i okur; WEBSITE_SANDBOX_URL artık kullanılmıyor.
// Route katmanı WEBSITE_AGENTIC bayrağını zaten kontrol eder — burada tekrar etme.
// ---------------------------------------------------------------------------

function isSandboxConfigured(): boolean {
  return (
    Boolean(process.env.DAYTONA_API_KEY) &&
    Boolean(process.env.WEBSITE_SANDBOX_HMAC_SECRET) &&
    Boolean(process.env.WEBSITE_CALLBACK_BASE)
  )
}

// ---------------------------------------------------------------------------
// Helper — website codegen için scope türet
// Website context'inde Meta/Google hesap kimliği yoktur; scope = userId.
// getProfileByUserId → en güncel profili döndürür (multi-account yoksa userId yeterli).
// ---------------------------------------------------------------------------

function deriveWebsiteScope(userId: string, _websiteId: string): string {
  // Website'a özgü reklam-hesabı kimlikleri olmadığından scope = userId (legacy path).
  // İleride site-bazlı profil eklenirse bu helper genişler.
  return userId
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
      const devPersistResult = await step.run('dev-fallback-generate', async () => {
        const site = await getWebsite(userId, websiteId)
        if (!site) {
          await markJobFailed(jobId, 'website_not_found')
          if (creditSpent > 0) {
            await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
          }
          return { ok: false as const, reason: 'website_not_found' }
        }

        await appendJobLog(jobId, 'building_page', 40, 'Sayfa inşa ediliyor (dev-fallback)')

        const result = await generateHtmlSite(userId, site, { instructions: brief })

        if (!result.ok) {
          await markJobFailed(jobId, `generate_failed:${result.reason}`)
          if (creditSpent > 0) {
            await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
          }
          return { ok: false as const, reason: `generate_failed:${result.reason}` }
        }

        // renderGate — SON OTORİTE
        const gated = gateSiteHtml(result.page.html ?? '')
        if (!gated.ok) {
          await markJobFailed(jobId, `gate_failed:${gated.reason}`)
          if (creditSpent > 0) {
            await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
          }
          return { ok: false as const, reason: `gate_failed:${gated.reason}` }
        }

        // İdempotent persist — markJobComplete bu adımın DIŞINDA (ayrı step)
        await persistGeneratedSite(userId, site, result, isRevision, creditSpent)
        return { ok: true as const, gatedHtml: gated.html, designVars: result.designVars, pageCount: result.pages.length }
      })

      if (devPersistResult.ok) {
        await step.run('mark-complete-devfallback', async () => {
          await markJobComplete(jobId, devPersistResult.gatedHtml, devPersistResult.designVars)
          return { ok: true }
        })
      }

      logger.info(`[website-agentic] dev-fallback tamamlandı: ${jobId}`)
      return { ok: devPersistResult.ok, jobId, mode: 'dev-fallback' }
    }

    // -----------------------------------------------------------------------
    // Yol B — Prod-sandbox (Faz 2 Stage B T4)
    // dispatch-sandbox: sandbox spawn → HIZLI DÖN (worker'ı beklemez)
    // -----------------------------------------------------------------------
    const dispatch = await step.run('dispatch-sandbox', async () => {
      try {
        await appendJobLog(jobId, 'building_page', 15, 'Sandbox işçisi başlatılıyor')

        // Scope türet — website context'inde reklam hesabı kimliği yok; userId kullan
        const scope = deriveWebsiteScope(userId, websiteId)

        // Marka profili — getProfileByUserId (site-bazlı scope yok; userId yeterli)
        const profile = await getProfileByUserId(userId)

        const callbackBase = process.env.WEBSITE_CALLBACK_BASE
        if (!callbackBase) {
          logger.error('[website-agentic] WEBSITE_CALLBACK_BASE env eksik')
          await markJobFailed(jobId, 'dispatch_failed:missing_callback_base')
          if (creditSpent > 0) await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
          return { ok: false as const }
        }

        const r = await runAgenticBuild({
          jobId,
          websiteId,
          userId,
          scope,
          brief: { instructions: brief },
          brandContextJson: JSON.stringify(profile ?? {}),
          callbackBase,
          hmacSecret: process.env.WEBSITE_SANDBOX_HMAC_SECRET!,
        })

        // Sandbox referansını DB'ye persist et (cleanup + timeout için gerekli)
        await persistSandboxRef(jobId, r.sandboxId, r.sessionId, r.cmdId)

        return { ok: true as const, ...r }
      } catch (e) {
        logger.error(`[website-agentic] dispatch-sandbox hata: ${e}`)
        await markJobFailed(jobId, 'dispatch_failed')
        if (creditSpent > 0) await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
        return { ok: false as const }
      }
    })

    if (!dispatch.ok) {
      logger.warn(`[website-agentic] dispatch başarısız: ${jobId}`)
      return { ok: false, jobId, reason: 'dispatch_failed' }
    }

    // waitForEvent/persist-result/handle-timeout — aynen korunur
    // T5 watchdog alignment: worker aborts after 15m; orchestrator waits 17m.
    // worker (15m) < waitForEvent (17m) → worker exits cleanly first,
    // fires /failed callback, sandbox self-cleans. Orchestrator timeout is
    // a last-resort safety net only (orphan cleanup + reconcile cron handle rest).
    const done = await step.waitForEvent('await-sandbox', {
      event: 'website/generate.sandbox-done',
      timeout: '17m',
      match: 'data.jobId',
    })

    if (!done) {
      // Timeout: sandbox sil + kredi iade + iş başarısız işaretle
      await step.run('handle-timeout', async () => {
        await markJobFailed(jobId, 'sandbox_timeout')
        if (creditSpent > 0) {
          await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
        }
        // Sandbox temizle (timeout durumunda da kaynakları serbest bırak)
        const ref = await getSandboxRef(jobId)
        if (ref?.sandboxId) {
          await deleteSandbox(ref.sandboxId)
        }
        await updateJobStatus(jobId, 'timeout')
        return { ok: false }
      })
      return { ok: false, jobId, reason: 'timeout' }
    }

    // Sandbox tamamlandı — persist (idempotent step)
    const sandboxPersistResult = await step.run('persist-result', async () => {
      const job = await getWebsiteGenJob(jobId)
      const site = await getWebsite(userId, websiteId)

      if (!site || !job?.generatedHtml) {
        await markJobFailed(jobId, 'persist_missing_input')
        if (creditSpent > 0) {
          await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
        }
        return { ok: false, jobId, error: 'persist_missing_input' }
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
      return { ok: true as const, gatedHtml: gated.html, designVars: job.designVars ?? {} }
    })

    if (sandboxPersistResult.ok && 'gatedHtml' in sandboxPersistResult) {
      const { gatedHtml, designVars } = sandboxPersistResult as { ok: true; gatedHtml: string; designVars: Record<string, string> }
      await step.run('mark-complete-sandbox', async () => {
        await markJobComplete(jobId, gatedHtml, designVars)
        return { ok: true }
      })
    }

    // Sandbox temizle (işçi bitti — kaynakları serbest bırak)
    await step.run('cleanup-sandbox', async () => {
      const ref = await getSandboxRef(jobId)
      if (ref?.sandboxId) {
        await deleteSandbox(ref.sandboxId)
      }
      return { ok: true }
    })

    logger.info(`[website-agentic] tamamlandı: ${jobId}`)
    return { ok: sandboxPersistResult.ok, jobId }
  },
)
