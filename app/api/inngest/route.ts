/* ──────────────────────────────────────────────────────────
   Inngest Serve Endpoint
   Vercel'de /api/inngest üzerinden Inngest function'ları
   sunar. Inngest Cloud bu endpoint'i polled.
   ────────────────────────────────────────────────────────── */

import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { yoalgoritmaScanUser } from '@/inngest/functions/yoalgoritmaScan'
import { yoalgoritmaPerAdImprovements } from '@/inngest/functions/perAdImprovements'
import { brandIngestionUser } from '@/inngest/functions/brandIngestion'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [yoalgoritmaScanUser, yoalgoritmaPerAdImprovements, brandIngestionUser],
})
