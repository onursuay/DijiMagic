/* ──────────────────────────────────────────────────────────
   Inngest Function: brand/ingest.user

   Brand Intelligence Ingestion (Faz 2). Tek kullanıcı için:
   kendi website + Instagram + Facebook (+ diğer) kaynaklarını tarar,
   deterministik iş zekasını üretir ve Claude marka sentezini ekler.

   Tetikleyiciler (event fırlatan taraflar):
     - Manuel "Marka Bilgilerini Yenile" butonu (UI)
     - Profil tamamlanma / URL güncelleme (opsiyonel — şimdilik route
       kendi senkron deterministik taramasını yapıyor)
     - Aylık opsiyonel cron (default kapalı bayrak)

   Concurrency 3. Soft-fail: sentez başarısızsa deterministik zeka kalır.
   ────────────────────────────────────────────────────────── */

import { inngest } from '../client'
import { runBrandProfilePipeline } from '@/lib/dijimagic/brandProfilePipeline'

export const brandIngestionUser = inngest.createFunction(
  {
    id: 'brand-ingestion-user',
    name: 'DijiAlgoritma — Brand Intelligence Ingestion',
    concurrency: { limit: 3 },
    retries: 2,
    triggers: [{ event: 'brand/ingest.user' }],
  },
  async ({ event, step, logger }) => {
    const userId = String(event.data?.userId ?? '')
    if (!userId) throw new Error('userId zorunlu')

    const result = await step.run('brand-pipeline', async () =>
      runBrandProfilePipeline(userId, { withSynthesis: true }),
    )

    logger.info(`[brand.ingest] ${userId}: scan=${result.scan_status} ownCompleted=${result.ownCompleted} synthesized=${result.synthesized}`)
    return { userId, ...result }
  },
)
