'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Settings2, Check } from 'lucide-react'
import type { BusinessGroup } from '@/lib/account/businessGroups'

interface Props {
  businesses: BusinessGroup[]
  selectedId: string | null
  busyId: string | null
  onSelect: (b: BusinessGroup) => void
  onManage: () => void
}

/**
 * DijiAlgoritma İşletme Seçici dropdown (Faz 3.4 — per-account).
 * Kayıtlı Meta+Google hesaplarını isim eşleştirmesiyle gruplanmış "işletme"
 * olarak listeler. Bir işletme seçilince DijiAlgoritma yalnız o işletmenin
 * Meta+Google verisini gösterir (başka hesabın verisi karışmaz).
 */
export default function BusinessSwitcherDropdown({
  businesses,
  selectedId,
  busyId,
  onSelect,
  onManage,
}: Props) {
  const t = useTranslations('account.businessSwitcher')

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <p className="text-ui font-medium text-gray-500">{t('title')}</p>
        <span className="text-xs font-semibold bg-primary/5 text-primary px-2 py-0.5 rounded-full ring-1 ring-primary/15">
          {t('count', { count: businesses.length })}
        </span>
      </div>

      <div className="max-h-72 overflow-y-auto py-1">
        {businesses.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-400">{t('empty')}</p>
        )}
        {businesses.map(b => {
          const active = selectedId === b.id
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelect(b)}
              disabled={busyId === b.id}
              className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between ${active ? 'bg-emerald-50' : ''}`}
            >
              <div className="min-w-0 flex items-center gap-1.5">
                <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
                {b.meta && (
                  <img src="/platform-icons/meta.svg" alt="Meta" width={14} height={14} className="w-3.5 h-3.5 shrink-0" />
                )}
                {b.google && (
                  <img src="/platform-icons/google-ads.svg" alt="Google" width={14} height={14} className="w-3.5 h-3.5 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {busyId === b.id
                  ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  : active && <Check className="w-4 h-4 text-emerald-600" />}
              </div>
            </button>
          )
        })}
      </div>

      <div className="p-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onManage}
          className="w-full flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          {t('manageAccounts')}
        </button>
      </div>
    </div>
  )
}
