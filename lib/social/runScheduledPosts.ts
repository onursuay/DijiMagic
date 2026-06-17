/**
 * Sosyal Medya Yönetimi — zamanlanmış yayın worker'ı.
 * Cron tarafından çağrılır. Due postları atomik claim eder, her hedefe yayınlar,
 * sonucu kaydeder. Kısmi başarıda retry sırasında zaten yayınlanmış hedefler
 * atlanır (duplicate yayın önlenir).
 */
import 'server-only'
import {
  claimDuePosts,
  markTargetResult,
  markPostPublished,
  markPostFailed,
} from './store'
import { publishToTarget } from './metaPublisher'

export interface RunResult {
  published: number
  failed: number
  total: number
}

export async function runScheduledPosts(limit = 25): Promise<RunResult> {
  const posts = await claimDuePosts(limit)
  let published = 0
  let failed = 0

  for (const post of posts) {
    // Her post kendi try/catch'inde: birinin beklenmeyen throw'u (DB/ağ) diğer
    // claim edilmiş postları 'publishing'de stranded bırakmasın.
    try {
      if (post.media.length === 0) {
        await markPostFailed(post, 'Medya bulunamadı')
        failed++
        continue
      }
      if (post.targets.length === 0) {
        await markPostFailed(post, 'Hedef hesap seçilmemiş')
        failed++
        continue
      }

      let allOk = true
      let anyPublished = false
      let firstError = ''

      for (const target of post.targets) {
        // Önceki denemede başarılı olan hedefi tekrar yayınlama (duplicate önleme).
        if (target.target_status === 'published') { anyPublished = true; continue }

        const res = await publishToTarget(post.user_id, {
          platform: target.platform,
          pageId: target.page_id,
          igUserId: target.ig_user_id,
          format: post.format,
          media: post.media.map((m) => ({ url: m.public_url, type: m.media_type })),
          caption: post.caption,
        })
        await markTargetResult(target.id, res)
        if (res.ok) anyPublished = true
        else {
          allOk = false
          if (!firstError) firstError = res.error || 'Bilinmeyen hata'
        }
      }

      if (allOk) {
        await markPostPublished(post.id)
        published++
      } else {
        // En az bir hedef yayınlandıysa retry tükenince 'partial' (kısmen yayınlandı).
        await markPostFailed(post, firstError, anyPublished)
        failed++
      }
    } catch (err: any) {
      await markPostFailed(post, err?.message || 'Beklenmeyen yayın hatası').catch(() => {})
      failed++
    }
  }

  return { published, failed, total: posts.length }
}
