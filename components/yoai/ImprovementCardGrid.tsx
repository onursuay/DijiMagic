'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Inbox, Loader2, RefreshCcw } from 'lucide-react'
import ImprovementCard from './ImprovementCard'
import type { AdImprovementRow, AdImprovementStatus } from '@/lib/yoai/ai/improvementStore'
import type { FullAdProposal } from '@/lib/yoai/adCreator'

interface Props {
  /** Onayla → ad_spec'ten üretilen proposal + improvement id ile yayın sihirbazını açar. */
  onApprovePublish: (proposal: FullAdProposal, improvementId: string) => void
  /** Parent bu değeri değiştirince grid yeniden fetch eder (yayın sonrası vb.). */
  refreshKey?: number
}

type PlatformFilter = 'all' | 'meta' | 'google'
type StatusFilter = 'all' | 'pending' | 'approved' | 'applied' | 'rejected'

export default function ImprovementCardGrid({ onApprovePublish, refreshKey }: Props) {
  const t = useTranslations('dashboard.yoai.improvements')
  const [rows, setRows] = useState<AdImprovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const fetchRows = useCallback(async () => {
    try {
      const res = await fetch('/api/yoai/improvements', { credentials: 'include' })
      const json = await res.json()
      if (json.ok && Array.isArray(json.data)) setRows(json.data as AdImprovementRow[])
    } catch (e) {
      console.warn('[ImprovementCardGrid] fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows, refreshKey])

  const handleScanNow = async () => {
    setScanning(true)
    try {
      await fetch('/api/yoai/improvements/scan', { method: 'POST', credentials: 'include' })
    } catch { /* sessiz */ } finally {
      setScanning(false)
    }
  }

  const handleApprove = async (row: AdImprovementRow) => {
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/yoai/improvements/${row.id}/approve`, { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (json.ok && json.data?.proposal) {
        onApprovePublish(json.data.proposal as FullAdProposal, row.id)
        await fetchRows()
      }
    } catch (e) {
      console.warn('[ImprovementCardGrid] approve failed:', e)
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (row: AdImprovementRow) => {
    setBusyId(row.id)
    try {
      await fetch(`/api/yoai/improvements/${row.id}/reject`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      await fetchRows()
    } catch (e) {
      console.warn('[ImprovementCardGrid] reject failed:', e)
    } finally {
      setBusyId(null)
    }
  }

  const visible = rows.filter((r) => {
    if (platformFilter !== 'all' && r.source_platform !== platformFilter) return false
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    return true
  })

  const platformOpts: { key: PlatformFilter; label: string }[] = [
    { key: 'all', label: t('filterAll') }, { key: 'meta', label: 'Meta' }, { key: 'google', label: 'Google' },
  ]
  const statusOpts: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'pending', label: t('status.pending') },
    { key: 'approved', label: t('status.approved') },
    { key: 'applied', label: t('status.applied') },
    { key: 'rejected', label: t('status.rejected') },
  ]

  return (
    <div data-testid="yoai-improvement-grid">
      {/* Başlık + Şimdi Tara */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
          <p className="text-xs text-gray-500">{t('subtitle')}</p>
        </div>
        <button
          onClick={handleScanNow}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          {scanning ? t('scanning') : t('scanNow')}
        </button>
      </div>

      {/* Filtreler */}
      {rows.length > 0 && (
        <div className="flex items-center gap-4 mb-4 flex-wrap text-xs">
          <FilterGroup label={t('filterPlatform')} options={platformOpts} active={platformFilter} onChange={(k) => setPlatformFilter(k as PlatformFilter)} />
          <FilterGroup label={t('filterStatus')} options={statusOpts} active={statusFilter} onChange={(k) => setStatusFilter(k as StatusFilter)} />
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Loader2 className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-spin" />
          <p className="text-sm text-gray-500">{t('loading')}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{rows.length === 0 ? t('empty') : t('emptyFiltered')}</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((row) => (
            <ImprovementCard
              key={row.id}
              improvement={row}
              busy={busyId === row.id}
              onApprove={() => handleApprove(row)}
              onReject={() => handleReject(row)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterGroup({ label, options, active, onChange }: {
  label: string
  options: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-400">{label}:</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`px-2 py-0.5 rounded-md transition-colors ${active === o.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
