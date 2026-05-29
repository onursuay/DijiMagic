/* ──────────────────────────────────────────────────────────
   Inngest Function: article/generate-publish.user

   Tek bir zamanlama (article_schedules) için tam otomatik SEO makale
   üretimi + yayını. İş mantığı lib/seo/runScheduleArticle.ts'te paylaşılır;
   böylece aynı akış Inngest YOKKEN cron route'unun INLINE yolundan da çağrılır.

   Meta/Google reklam akışlarından tamamen bağımsızdır.
   ────────────────────────────────────────────────────────── */

import { inngest } from '../client'
import { runScheduleArticle } from '@/lib/seo/runScheduleArticle'

interface EventData {
  scheduleId: string
  userId: string
}

export const seoArticleGeneratePublish = inngest.createFunction(
  {
    id: 'seo-article-generate-publish',
    name: 'SEO — Otomatik Makale Üret + Yayınla',
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: 'article/generate-publish.user' }],
  },
  async ({ event, step }) => {
    const { scheduleId, userId } = event.data as EventData
    // Tüm üretim+yayın akışı paylaşılan helper'da; tek step ile durability korunur.
    return await step.run('generate-and-publish', () => runScheduleArticle(scheduleId, userId))
  },
)
