/**
 * GET /api/social/targets
 * Kullanıcının bağlı Facebook sayfaları + bağlı Instagram işletme hesaplarını
 * döndürür (içerik planlarken hedef seçimi için). Token hem cookie (interaktif,
 * en güncel) hem DB (kalıcı bağlantı) kaynağından çözülür — biri boşsa diğerine düşer.
 *
 * Yanıt ayrımı:
 *   - not_connected (401): Meta hiç bağlı değil → UI "Entegrasyon'a git" gösterir.
 *   - ok + data:[]      : Bağlı ama yayınlanabilir sayfa/IG yok.
 *   - ok + data:[...]   : Hedef listesi.
 */
import { NextResponse } from 'next/server'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { getUserAccessToken } from '@/lib/meta/authHelpers'
import { getMetaConnection } from '@/lib/metaConnectionStore'
import { MetaGraphClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

interface PageEntry {
  id: string
  name: string
  picture?: { data?: { url?: string } }
  instagram_business_account?: {
    id: string
    username: string
    profile_picture_url?: string
  }
}

export async function GET() {
  const access = await chargeFeature({ featureKey: 'social_media_management', requireSubscription: true })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  // Token: önce cookie (interaktif, en güncel), yoksa DB (kalıcı bağlantı).
  let token = await getUserAccessToken()
  if (!token) {
    const conn = await getMetaConnection(access.user.id)
    token = conn?.accessToken ?? null
  }
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'not_connected', message: 'Meta hesabı bağlı değil' },
      { status: 401 },
    )
  }

  const client = new MetaGraphClient({ accessToken: token })
  const result = await client.get<{ data?: PageEntry[] }>('/me/accounts', {
    fields: 'id,name,picture{url},instagram_business_account{id,username,profile_picture_url}',
    limit: '100',
  })
  if (!result.ok) {
    // Token geçersiz/iptal → bağlantı yenilenmeli.
    const notConnected = result.status === 401 || result.status === 403
    return NextResponse.json(
      {
        ok: false,
        error: notConnected ? 'not_connected' : 'fetch_failed',
        message: result.error?.message || 'Sayfalar alınamadı',
      },
      { status: notConnected ? 401 : (result.status || 500) },
    )
  }

  const pages = (result.data?.data ?? []).map((page) => ({
    pageId: page.id,
    pageName: page.name,
    pageImageUrl: page.picture?.data?.url || null,
    instagram: page.instagram_business_account
      ? {
          igUserId: page.instagram_business_account.id,
          username: page.instagram_business_account.username,
          profilePictureUrl: page.instagram_business_account.profile_picture_url || null,
        }
      : null,
  }))

  return NextResponse.json({ ok: true, data: pages })
}
