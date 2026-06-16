import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/billing/user'
import {
  isMultiAccountEnabled,
  ensureBackfilled,
  listRegisteredAccounts,
  resolveAccountLimit,
  addRegisteredAccount,
  removeRegisteredAccount,
  normAcct,
  type AdPlatform,
} from '@/lib/account/registeredAccounts'
import { isPerAccountScopeEnabled } from '@/lib/yoai/featureFlag'
import { COOKIE } from '@/lib/google-ads/constants'
import { updateSelectedMetaAdAccount, updateMetaConnectionHealth } from '@/lib/metaConnectionStore'
import { upsertConnection as upsertGoogleConnection, revokeConnection as revokeGoogleConnection } from '@/lib/googleAdsConnectionStore'

/** Meta seçim cookie'leri için select-adaccount ile birebir aynı seçenekler. */
const META_COOKIE_OPTS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 30, path: '/' }
const META_ALL_COOKIES = ['meta_access_token', 'meta_access_expires_at', 'meta_token_type', 'meta_granted_scopes', 'meta_denied_scopes', 'meta_selected_ad_account_id', 'meta_selected_ad_account_name', 'selected_meta_ad_account']
const GOOGLE_SELECTION_COOKIES = [COOKIE.CUSTOMER_ID, COOKIE.LOGIN_CUSTOMER_ID, COOKIE.ACCOUNT_NAME, COOKIE.CUSTOMER_NAME, COOKIE.IS_MANAGER]

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   Çoklu Reklam Hesabı (Madde 2 — Faz 2.1)
   Kullanıcının kayıtlı (faturalanan) hesap kümesini yönetir.
   Limit gate burada uygulanır; Meta/Google SEÇİM route'larına
   dokunulmaz — UI "önce kaydet → sonra seç" akışıyla çağırır.
   `MULTI_ACCOUNT_ENABLED` kapalıyken pasif (default-off).
   ──────────────────────────────────────────────────────────── */

function isValidPlatform(p: unknown): p is AdPlatform {
  return p === 'meta' || p === 'google'
}

// GET — kayıtlı hesaplar + limit + count + kalan
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  if (!isMultiAccountEnabled()) {
    return NextResponse.json({ ok: true, enabled: false, perAccountScope: false, accounts: [], count: 0, limit: 0, remaining: 0 })
  }

  await ensureBackfilled(user.id)
  const [accounts, limit] = await Promise.all([
    listRegisteredAccounts(user.id),
    resolveAccountLimit(user.id),
  ])
  const count = accounts.length
  const limitNum = Number.isFinite(limit) ? limit : null // null = sınırsız (owner)
  return NextResponse.json({
    ok: true,
    enabled: true,
    // YoAlgoritma işletme-scope modu açık mı (UI seçiciyi işletme moduna alır)
    perAccountScope: isPerAccountScopeEnabled(),
    accounts,
    count,
    limit: limitNum,
    remaining: limitNum === null ? null : Math.max(0, limitNum - count),
  })
}

// POST — hesap ekle (plan limiti zorlanır)
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  if (!isMultiAccountEnabled()) {
    return NextResponse.json({ ok: false, error: 'feature_disabled' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const platform = body?.platform
  const accountId = (body?.account_id ?? '').toString().trim()
  if (!isValidPlatform(platform) || !accountId) {
    return NextResponse.json({ ok: false, error: 'invalid_input', message: 'platform ve account_id gerekli' }, { status: 400 })
  }

  await ensureBackfilled(user.id)
  const result = await addRegisteredAccount(user.id, {
    platform,
    account_id: accountId,
    account_name: (body?.account_name as string | undefined) ?? null,
    login_customer_id: (body?.login_customer_id as string | undefined) ?? null,
  })

  if (!result.ok) {
    if (result.error === 'limit_reached') {
      return NextResponse.json(
        {
          ok: false,
          error: 'limit_reached',
          count: result.count,
          limit: result.limit,
          message: `Plan limitinize ulaştınız (${result.count}/${result.limit}). Daha fazla reklam hesabı için planınızı yükseltin.`,
        },
        { status: 403 },
      )
    }
    return NextResponse.json({ ok: false, error: result.error, message: result.message }, { status: 500 })
  }

  return NextResponse.json(
    { ok: true, account: result.account, alreadyRegistered: result.alreadyRegistered },
    { status: result.alreadyRegistered ? 200 : 201 },
  )
}

// DELETE — hesabı kümeden çıkar (?platform=meta&account_id=act_xxx)
export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  if (!isMultiAccountEnabled()) {
    return NextResponse.json({ ok: false, error: 'feature_disabled' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform')
  const accountId = (searchParams.get('account_id') ?? '').trim()
  if (!isValidPlatform(platform) || !accountId) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 })
  }

  // Silmeden ÖNCE cookie'deki aktif hesabı oku (silinen, dashboard'un gösterdiği aktif miydi?).
  const jar = await cookies()
  const removed = normAcct(accountId)
  const cookieActiveBefore = platform === 'meta'
    ? normAcct(jar.get('meta_selected_ad_account_id')?.value) === removed
    : normAcct(jar.get(COOKIE.CUSTOMER_ID)?.value) === removed

  const outcome = await removeRegisteredAccount(user.id, platform, accountId)
  if (!outcome.ok) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  // KÖK ÇÖZÜM: silinen hesap aktifse (DB ya da cookie) → cookie + DB'yi birlikte senkronla.
  // Aksi halde dashboard/status cookie'den eski hesabı okumaya devam ederdi ("sildim ama görünüyor").
  const wasActive = outcome.wasActiveInDb || cookieActiveBefore
  let disconnected = false

  if (wasActive && outcome.next) {
    // Kalan bir hesaba geçir.
    const next = outcome.next
    if (platform === 'meta') {
      if (!outcome.wasActiveInDb) await updateSelectedMetaAdAccount(user.id, next.accountId)
      const actId = next.accountId.startsWith('act_') ? next.accountId : `act_${next.accountId.replace(/^act_/i, '')}`
      jar.set('meta_selected_ad_account_id', actId, META_COOKIE_OPTS)
      jar.set('selected_meta_ad_account', actId, META_COOKIE_OPTS)
      jar.set('meta_selected_ad_account_name', next.name || actId, META_COOKIE_OPTS)
    } else {
      if (!outcome.wasActiveInDb) await upsertGoogleConnection(user.id, { customerId: next.accountId, loginCustomerId: next.loginCustomerId || next.accountId })
      // Seçim cookie'lerini sil → /selected DB'ye düşüp kalan hesabı döndürür (cookie-set riski yok).
      for (const c of GOOGLE_SELECTION_COOKIES) jar.delete(c)
    }
  } else if (wasActive && !outcome.next) {
    // Başka kayıtlı hesap yok → TAM DISCONNECT: DB revoke + TÜM platform cookie'lerini sil.
    disconnected = true
    if (platform === 'meta') {
      if (!outcome.wasActiveInDb) await updateMetaConnectionHealth(user.id, 'revoked', 'last_account_removed')
      for (const c of META_ALL_COOKIES) jar.delete(c)
    } else {
      if (!outcome.wasActiveInDb) await revokeGoogleConnection(user.id)
      jar.delete(COOKIE.REFRESH_TOKEN)
      for (const c of GOOGLE_SELECTION_COOKIES) jar.delete(c)
    }
  }

  return NextResponse.json({ ok: true, wasActive, disconnected, next: outcome.next })
}
