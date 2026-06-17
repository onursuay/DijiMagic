'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X, Check } from 'lucide-react'
import type { SocialProject } from '@/lib/social/types'

const PALETTE = ['#10b981', '#0ea5e9', '#6366f1', '#ec4899', '#f97316', '#14b8a6', '#8b5cf6']

export default function ProjectBar({
  projects,
  activeProjectId,
  onSelect,
  onCreate,
}: {
  projects: SocialProject[]
  activeProjectId: string | null
  onSelect: (id: string | null) => void
  onCreate: (name: string, color: string) => Promise<void>
}) {
  const t = useTranslations('dashboard.sosyalmedya.project')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      await onCreate(trimmed, color)
      setName('')
      setColor(PALETTE[0])
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const chip = (id: string | null, label: string, dotColor?: string) => {
    const active = activeProjectId === id
    return (
      <button
        key={id ?? 'all'}
        type="button"
        onClick={() => onSelect(id)}
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
          active
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
        }`}
      >
        {dotColor && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />}
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chip(null, t('all'))}
      {projects.map((p) => chip(p.id, p.name, p.color))}

      {adding ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-white py-1 pl-2 pr-1 shadow-sm">
          <div className="flex items-center gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="flex h-4 w-4 items-center justify-center rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
                aria-label={c}
              >
                {color === c && <Check className="h-2.5 w-2.5 text-white" />}
              </button>
            ))}
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false) }}
            placeholder={t('namePlaceholder')}
            className="w-48 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || saving}
            className="rounded-full bg-primary p-1.5 text-white transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40"
            aria-label={t('create')}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('cancel')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-500 transition-all hover:border-primary/40 hover:text-primary active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          {t('new')}
        </button>
      )}
    </div>
  )
}
