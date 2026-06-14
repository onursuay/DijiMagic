'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Globe2, Check, Clock, X, RotateCcw } from 'lucide-react'

interface DnsRecord { type: string; name: string; value: string }
interface DomainData { domain: string | null; verified?: boolean; records?: DnsRecord[]; configured?: boolean }

export default function DomainPanel({ websiteId }: { websiteId: string }) {
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const [data, setData] = useState<DomainData | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/website/${websiteId}/domain`).then((r) => r.json()).catch(() => null)
    if (res?.ok) setData({ domain: res.domain, verified: res.verified, records: res.records, configured: res.configured })
  }, [websiteId])
  useEffect(() => { load() }, [load])

  const attach = async () => {
    const d = input.trim()
    if (!d) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/website/${websiteId}/domain`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: d }),
      })
      const json = await res.json()
      if (json.ok) { setData({ domain: json.domain, verified: json.verified, records: json.records, configured: true }); setInput('') }
      else setError(json.error || t('domainError'))
    } catch {
      setError(t('domainError'))
    } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try {
      await fetch(`/api/website/${websiteId}/domain`, { method: 'DELETE' })
      setData((p) => ({ ...(p || {}), domain: null, records: undefined, verified: undefined }))
    } finally { setBusy(false) }
  }
  const recheck = async () => { setBusy(true); await load(); setBusy(false) }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-card-enter">
      <div className="flex items-center gap-2">
        <Globe2 className="w-4 h-4 text-primary" />
        <h2 className="text-base font-semibold text-gray-900">{t('domainTitle')}</h2>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">{t('domainHint')}</p>
      {data?.configured === false && <p className="mt-2 text-xs text-gray-500">{t('domainNotConfigured')}</p>}

      {!data?.domain ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('domainPlaceholder')}
            inputMode="url"
            className="flex-1 min-w-[200px] rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            onClick={attach}
            disabled={busy || !input.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {busy ? t('domainConnecting') : t('domainConnect')}
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-gray-900">{data.domain}</span>
            {data.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5">
                <Check className="w-3.5 h-3.5" />{t('domainConnected')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5">
                <Clock className="w-3.5 h-3.5" />{t('domainPending')}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={recheck} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5" />{t('domainRecheck')}
              </button>
              <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50/60 transition-colors disabled:opacity-50">
                <X className="w-3.5 h-3.5" />{t('domainRemove')}
              </button>
            </div>
          </div>
          {!data.verified && data.records && data.records.length > 0 && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs text-gray-600 mb-2">{t('domainDnsTitle')}</p>
              <div className="space-y-1.5">
                {data.records.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-mono">
                    <span className="text-gray-500 w-12">{r.type}</span>
                    <span className="text-gray-800">{r.name}</span>
                    <span className="text-gray-800 select-all">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
