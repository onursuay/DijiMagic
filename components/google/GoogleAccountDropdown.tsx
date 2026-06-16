'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, Plus, Trash2, Loader2, ArrowUpRight, ArrowLeft } from 'lucide-react'
import type { useGoogleAdsConnection } from '@/hooks/google/useGoogleAdsConnection'
import { useRegisteredAccounts } from '@/hooks/useRegisteredAccounts'
import { clearYoAlgoritmaClientCache } from '@/lib/yoai/clientCache'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'

/** Hesap id normalize (tire farkını yok say — aktif eşleşmesi güvenli olsun). */
const normId = (s: string | null | undefined): string => (s ?? '').replace(/-/g, '').trim().toLowerCase()

type GoogleConnection = ReturnType<typeof useGoogleAdsConnection>

interface Props {
  connection: GoogleConnection
  isAppReview?: boolean
}

/**
 * Google reklam hesabı switcher — Meta `MultiAccountDropdown` tasarımının birebir
 * Google muadili. Hover ile açılan küçük dropdown; kayıtlı hesaplar + hesap ekleme
 * (managers/children browse) + bağlantı kesme HEPSİ tek panel içinde — ayrı modal yok.
 * (İlk zorunlu hesap seçimi — hiç hesap yokken — hâlâ `GoogleAccountModal` ile yapılır.)
 */
export default function GoogleAccountDropdown({ connection, isAppReview = false }: Props) {
  const t = useTranslations('dashboard.meta.accounts')
  const tEnt = useTranslations('dashboard.entegrasyon.google')
  const router = useRouter()
  const reg = useRegisteredAccounts()

  const [open, setOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const multi = reg.enabled
  const activeId = connection.selected?.customerId ?? null
  const activeName = connection.selected?.customerName ?? null

  const googleRegistered = reg.accounts.filter(a => a.platform === 'google')
  const atLimit = multi && reg.limit !== null && reg.remaining !== null && reg.remaining <= 0
  const usedLabel = reg.limit === null
    ? t('accountsUsedUnlimited', { count: googleRegistered.length })
    : t('accountsUsed', { count: googleRegistered.length, limit: reg.limit })

  // İsim çözümü: kayıt isim taşımıyorsa (backfill) aktif/browse isimlerinden çöz
  const nameById = new Map<string, string>()
  connection.managers.forEach(m => nameById.set(m.customerId, m.name))
  connection.children.forEach(c => nameById.set(c.customerId, c.name))
  if (activeId && activeName) nameById.set(activeId, activeName)
  const displayName = (acc: { account_id: string; account_name: string | null }) =>
    nameById.get(acc.account_id) ||
    (acc.account_name && acc.account_name !== acc.account_id ? acc.account_name : `Hesap ${acc.account_id}`)

  // Browse listesinde zaten kayıtlı hesaplar gizlenir (yöneticiler derinleşmek için kalır)
  const registeredGoogleIds = new Set(googleRegistered.map(a => a.account_id))
  const visibleManagers = connection.managers.filter(m => m.isManager || !registeredGoogleIds.has(m.customerId))
  const visibleChildren = connection.children.filter(c => !registeredGoogleIds.has(c.customerId))

  const handleMouseEnter = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setOpen(true)
  }
  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => { setOpen(false); setShowAdd(false) }, 200)
  }

  const isPicking = (customerId: string) =>
    busyId === customerId ||
    connection.selectingKey === `account:${customerId}` ||
    connection.selectingKey === `manager:${customerId}`
  const busy = !!connection.selectingKey || !!busyId

  // Kayıtlı bir Google hesabına geç (mevcut select-account endpoint'i + reload)
  const switchToRegistered = async (acc: typeof googleRegistered[number]) => {
    if (normId(acc.account_id) === normId(activeId) || busy) return
    setBusyId(acc.account_id)
    try {
      await fetch('/api/integrations/google-ads/select-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          loginCustomerId: acc.login_customer_id || acc.account_id,
          customerId: acc.account_id,
          ...(acc.account_name && acc.account_name !== acc.account_id ? { customerName: acc.account_name } : {}),
        }),
      })
      clearYoAlgoritmaClientCache()
      window.location.reload()
    } catch {
      setBusyId(null)
    }
  }

  const handleRemove = async (e: React.MouseEvent, acc: typeof googleRegistered[number]) => {
    e.stopPropagation()
    if (busy) return
    const wasActive = normId(acc.account_id) === normId(activeId)
    setBusyId(acc.account_id)
    await reg.removeAccount('google', acc.account_id)
    // Aktif hesabı sildiyse bağlantı sunucuda kalan hesaba geçti (ya da kesildi) → yansıt.
    if (wasActive) { clearYoAlgoritmaClientCache(); window.location.reload(); return }
    setBusyId(null)
  }

  // "Hesap Ekle" aç/kapa — açılınca managers fetch tetiklenir
  const toggleAdd = () => {
    if (atLimit) { setShowLimitModal(true); return }
    const next = !showAdd
    setShowAdd(next)
    if (next) connection.loadAccounts()
  }

  // Browse seçimi: yöneticiyse derinleş; hesapsa (çoklu) önce kaydet sonra seç, (tek) direkt seç
  const handleBrowsePick = async (item: { customerId: string; name: string; isManager: boolean }, isChild: boolean) => {
    if (!multi) {
      isChild ? connection.onChildClick(item) : connection.onManagerOrAccountClick(item)
      return
    }
    if (!isChild && item.isManager) {
      connection.onManagerOrAccountClick(item) // yöneticiye derinleş
      return
    }
    const loginCustomerId = isChild ? (connection.selectedManagerId ?? item.customerId) : item.customerId
    setBusyId(item.customerId)
    const res = await reg.addAccount({
      platform: 'google',
      account_id: item.customerId,
      account_name: item.name,
      login_customer_id: loginCustomerId,
    })
    setBusyId(null)
    if (!res.ok && res.error === 'limit_reached') { setShowLimitModal(true); return }
    isChild ? connection.onChildClick(item) : connection.onManagerOrAccountClick(item)
  }

  const handleDisconnect = async () => {
    if (!confirm(tEnt('disconnect'))) return
    await fetch('/api/integrations/google-ads/disconnect', { method: 'POST', credentials: 'include' }).catch(() => {})
    router.push('/entegrasyon')
  }

  return (
    <>
      <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {/* Tetikleyici — CONNECTED state (Meta ile birebir) */}
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-white border border-green-400 rounded-lg hover:bg-green-50 transition-all shadow-[0_0_8px_rgba(34,197,94,0.3)] hover:shadow-[0_0_12px_rgba(34,197,94,0.5)]"
        >
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-gray-700">{activeName || (activeId ? `Hesap ${activeId}` : 'Google Ads')}</span>
          <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            {isAppReview ? 'Connected' : t('connected')}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <p className="text-ui font-medium text-gray-500">{isAppReview ? 'Ad Accounts' : t('title')}</p>
              {multi && (
                <span className="text-xs font-semibold bg-primary/5 text-primary px-2 py-0.5 rounded-full ring-1 ring-primary/15">
                  {usedLabel}
                </span>
              )}
            </div>

            {/* Google hesapları */}
            <div className="max-h-64 overflow-y-auto">
              <div className="px-3 pt-2 pb-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('googleAccounts')}</p>
              </div>

              {multi && googleRegistered.length > 0 ? (
                googleRegistered.map(acc => {
                  const active = normId(acc.account_id) === normId(activeId)
                  return (
                    <button
                      key={acc.account_id}
                      type="button"
                      onClick={() => switchToRegistered(acc)}
                      disabled={busy}
                      className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between ${active ? 'bg-green-50' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{displayName(acc)}</p>
                        <p className="text-caption text-gray-500 font-mono">ID: {acc.account_id}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {active && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                        {busyId === acc.account_id && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                        {busyId !== acc.account_id && (
                          <span onClick={e => handleRemove(e, acc)} title={t('remove')} className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })
              ) : (
                /* Tek hesap modu — yalnız aktif hesap */
                <div className="px-4 py-2.5 flex items-center justify-between bg-green-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{activeName || (activeId ? `Hesap ${activeId}` : '—')}</p>
                    {activeId && <p className="text-caption text-gray-500 font-mono">ID: {activeId}</p>}
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full shrink-0" />
                </div>
              )}
            </div>

            {/* Hesap ekle / değiştir — browse panel içinde */}
            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={toggleAdd}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" />{multi ? t('addAccount') : tEnt('selectAccountTitle')}</span>
                {!atLimit && <ChevronDown className={`w-4 h-4 transition-transform ${showAdd ? 'rotate-180' : ''}`} />}
              </button>

              {atLimit && (
                <div className="mx-3 mb-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
                  <p className="text-sm font-medium text-gray-800">{t('limitReachedTitle')} ({usedLabel})</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('upgradeForMore')}</p>
                  <button type="button" onClick={() => setShowLimitModal(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    {t('viewPlans')} <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {!atLimit && showAdd && (
                <div className="max-h-44 overflow-y-auto pb-1">
                  {/* Children adımında geri butonu */}
                  {connection.accountStep === 'children' && (
                    <button type="button" onClick={connection.backToManagers} className="w-full text-left px-4 py-1.5 text-xs text-primary hover:underline flex items-center gap-1">
                      <ArrowLeft className="w-3 h-3" /> {tEnt('selectAccountTitle')}
                    </button>
                  )}

                  {(connection.accountStep === 'managers' ? connection.managersLoading : connection.childrenLoading) && (
                    <p className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-primary" /> {tEnt('selecting')}</p>
                  )}

                  {connection.accountsError && !connection.managersLoading && !connection.childrenLoading && (
                    <p className="px-4 py-2 text-sm text-red-600 leading-relaxed">{connection.accountsError}</p>
                  )}

                  {/* Managers / hesaplar */}
                  {connection.accountStep === 'managers' && !connection.managersLoading && visibleManagers.map(m => (
                    <button
                      key={m.customerId}
                      type="button"
                      onClick={() => handleBrowsePick(m, false)}
                      disabled={busy}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700 truncate">{m.name}</p>
                        <p className="text-caption text-gray-400 font-mono">
                          {m.isManager ? tEnt('managerBadge') : tEnt('accountBadge')} · ID: {m.customerId}
                        </p>
                      </div>
                      {isPicking(m.customerId)
                        ? <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                        : (m.isManager ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 -rotate-90" /> : <Plus className="w-4 h-4 text-primary shrink-0" />)}
                    </button>
                  ))}
                  {connection.accountStep === 'managers' && !connection.managersLoading && !connection.accountsError && visibleManagers.length === 0 && (
                    <p className="px-4 py-2 text-sm text-gray-400">{connection.managers.length > 0 ? t('noMoreToAdd') : tEnt('noAccounts')}</p>
                  )}

                  {/* Children */}
                  {connection.accountStep === 'children' && !connection.childrenLoading && visibleChildren.map(c => (
                    <button
                      key={c.customerId}
                      type="button"
                      onClick={() => handleBrowsePick(c, true)}
                      disabled={busy}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700 truncate">{c.name}</p>
                        <p className="text-caption text-gray-400 font-mono">ID: {c.customerId}</p>
                      </div>
                      {isPicking(c.customerId)
                        ? <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                        : <Plus className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  ))}
                  {connection.accountStep === 'children' && !connection.childrenLoading && !connection.accountsError && visibleChildren.length === 0 && (
                    <p className="px-4 py-2 text-sm text-gray-400">{connection.children.length > 0 ? t('noMoreToAdd') : tEnt('noChildren')}</p>
                  )}
                </div>
              )}
            </div>

            {/* Bağlantıyı kes */}
            <div className="p-3 border-t border-gray-200">
              <button onClick={handleDisconnect} className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
                {isAppReview ? 'Disconnect' : t('disconnect')}
              </button>
            </div>
          </div>
        )}
      </div>

      {showLimitModal && (
        <AccessRequiredModal
          type="subscription"
          featureKey="ad_account_slot"
          dismissible
          onClose={() => setShowLimitModal(false)}
          reason="multi_account_limit_google"
        />
      )}
    </>
  )
}
