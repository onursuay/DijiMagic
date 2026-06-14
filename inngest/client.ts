/* ──────────────────────────────────────────────────────────
   Inngest Client (singleton)

   Faz 2: YoAlgoritma AI Engine için durable agentic loop.
   Vercel cron 300s sınırına takılmamak için fan-out + per-account
   Inngest event'leri kullanılır.

   Inngest opsiyoneldir: INNGEST_EVENT_KEY tanımlı değilse cron
   endpoint inline mod'a düşer (test/dev için).
   ────────────────────────────────────────────────────────── */

import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'yoai-ai-engine',
  name: 'YoAi AI Engine',
})

export function isInngestReady(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV)
}

/**
 * R2: Cloud mode'da function ÇALIŞTIRMAK için INNGEST_SIGNING_KEY şart. EVENT_KEY var ama
 * SIGNING_KEY yoksa event gönderilir (cron yeşil görünür) AMA hiçbir function tetiklenmez →
 * sessiz "hiç kart üretilmez" tuzağı. Uyarı string'i döner (dev'de yoksay); yoksa null.
 */
export function inngestSigningKeyWarning(): string | null {
  if (process.env.INNGEST_DEV) return null
  if (process.env.INNGEST_EVENT_KEY && !process.env.INNGEST_SIGNING_KEY) {
    return 'INNGEST_SIGNING_KEY eksik — event gönderilir ama function ÇALIŞMAZ (cloud mode). Kart üretilmez.'
  }
  return null
}
