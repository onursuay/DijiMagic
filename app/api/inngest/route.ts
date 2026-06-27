/* ──────────────────────────────────────────────────────────
   Inngest Serve Endpoint
   Vercel'de /api/inngest üzerinden Inngest function'ları
   sunar. Inngest Cloud bu endpoint'i polled.
   ────────────────────────────────────────────────────────── */

import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { dijialgoritmaScanUser } from '@/inngest/functions/dijialgoritmaScan'
import { dijialgoritmaPerAdImprovements } from '@/inngest/functions/perAdImprovements'
import { dijialgoritmaPerCampaignImprovements } from '@/inngest/functions/perCampaignImprovements'
import { brandIngestionUser } from '@/inngest/functions/brandIngestion'
import { seoArticleGeneratePublish } from '@/inngest/functions/seoArticleRun'
import { strategyRunJobs } from '@/inngest/functions/strategyRunJobs'
import { officialAdsRefresh } from '@/inngest/functions/officialAdsRefresh'
import { websiteAgenticGenerate } from '@/inngest/functions/websiteAgenticGenerate'

// Strateji blueprint üretimi (Claude, 8000 token) tek invocation'da uzun
// sürebilir; serve endpoint'ine geniş süre bütçesi tanı.
export const maxDuration = 120

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    dijialgoritmaScanUser,
    dijialgoritmaPerAdImprovements,        // Faz 2 — paralel korunur (deprecate sonra)
    dijialgoritmaPerCampaignImprovements,  // Faz 3 — hiyerarşik kartlar (aktif)
    brandIngestionUser,
    seoArticleGeneratePublish,           // SEO — otomatik günlük makale üret+yayınla
    strategyRunJobs,                     // Strateji — kuyruktaki işleri arka planda çalıştır
    officialAdsRefresh,                  // Resmi reklam dokümanı taraması (kaynak-başına step)
    websiteAgenticGenerate,              // Faz 1.3 — Agentic website generator (WEBSITE_AGENTIC flag)
  ],
})
