'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import { ToastContainer, type Toast } from '@/components/Toast'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import ProjectBar from './ProjectBar'
import FormatTabs from './FormatTabs'
import SocialCalendar from './SocialCalendar'
import PostComposerModal from './PostComposerModal'
import type {
  SocialFormat, SocialProject, SocialPostWithRelations, MetaTargetAccount,
} from '@/lib/social/types'

export default function SocialMediaPage() {
  const t = useTranslations('dashboard.sosyalmedya')
  const { loading: subLoading, hasSubscription, isOwner } = useSubscription()

  const [projects, setProjects] = useState<SocialProject[]>([])
  const [targets, setTargets] = useState<MetaTargetAccount[]>([])
  const [metaConnected, setMetaConnected] = useState(true)
  const [posts, setPosts] = useState<SocialPostWithRelations[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [format, setFormat] = useState<SocialFormat>('feed')
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [composerOpen, setComposerOpen] = useState(false)
  const [editPost, setEditPost] = useState<SocialPostWithRelations | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const showGate = !subLoading && !hasSubscription && !isOwner

  const addToast = useCallback((message: string, type: Toast['type']) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, type }])
  }, [])
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/social/projects')
      const json = await res.json()
      if (json.ok) setProjects(json.data ?? [])
    } catch { /* sessiz */ }
  }, [])

  const fetchTargets = useCallback(async () => {
    try {
      const res = await fetch('/api/social/targets')
      const json = await res.json()
      if (json.ok) { setTargets(json.data ?? []); setMetaConnected(true) }
      else if (json.error === 'not_connected') { setTargets([]); setMetaConnected(false) }
    } catch { setTargets([]) }
  }, [])

  const fetchPosts = useCallback(async () => {
    const year = monthCursor.getFullYear()
    const month = monthCursor.getMonth()
    const from = new Date(year, month, 1).toISOString()
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const params = new URLSearchParams({ from, to })
    if (activeProjectId) params.set('projectId', activeProjectId)
    if (format) params.set('format', format)
    try {
      const res = await fetch(`/api/social/posts?${params.toString()}`)
      const json = await res.json()
      if (json.ok) setPosts(json.data ?? [])
      else if (res.status !== 403) addToast(t('toasts.loadError'), 'error')
    } catch {
      addToast(t('toasts.loadError'), 'error')
    }
  }, [monthCursor, activeProjectId, format, addToast, t])

  useEffect(() => { if (!showGate) { fetchProjects(); fetchTargets() } }, [showGate, fetchProjects, fetchTargets])
  useEffect(() => { if (!showGate) fetchPosts() }, [showGate, fetchPosts])

  const createProject = useCallback(async (name: string, color: string) => {
    try {
      const res = await fetch('/api/social/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      })
      const json = await res.json()
      if (json.ok) { addToast(t('project.created'), 'success'); await fetchProjects() }
      else addToast(t('project.createError'), 'error')
    } catch { addToast(t('project.createError'), 'error') }
  }, [addToast, fetchProjects, t])

  const openNewComposer = useCallback((d?: Date) => {
    setEditPost(null)
    if (d) setSelectedDate(d)
    setComposerOpen(true)
  }, [])

  const openEditComposer = useCallback((p: SocialPostWithRelations) => {
    setEditPost(p)
    setComposerOpen(true)
  }, [])

  const submitComposer = useCallback(async (payload: Parameters<typeof JSON.stringify>[0], editId: string | null) => {
    try {
      if (editId) {
        const body = payload as { caption: string | null; scheduledAt: string }
        const res = await fetch(`/api/social/posts/${editId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption: body.caption, scheduledAt: body.scheduledAt, projectId: activeProjectId }),
        })
        const json = await res.json()
        if (json.ok) { addToast(t('toasts.updated'), 'success'); await fetchPosts(); return true }
        addToast(t('toasts.createError'), 'error'); return false
      }
      const res = await fetch('/api/social/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(payload as object), projectId: activeProjectId }),
      })
      const json = await res.json()
      if (json.ok) { addToast(t('toasts.created'), 'success'); await fetchPosts(); return true }
      addToast(json.message || t('toasts.createError'), 'error'); return false
    } catch {
      addToast(t('toasts.createError'), 'error'); return false
    }
  }, [activeProjectId, addToast, fetchPosts, t])

  const cancelPost = useCallback(async (p: SocialPostWithRelations) => {
    if (!window.confirm(t('post.cancelConfirm'))) return
    try {
      const res = await fetch(`/api/social/posts/${p.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.ok) { addToast(t('toasts.cancelled'), 'success'); await fetchPosts() }
    } catch { /* sessiz */ }
  }, [addToast, fetchPosts, t])

  const retryPost = useCallback(async (p: SocialPostWithRelations) => {
    try {
      const res = await fetch(`/api/social/posts/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      })
      const json = await res.json()
      if (json.ok) { addToast(t('toasts.retried'), 'success'); await fetchPosts() }
    } catch { /* sessiz */ }
  }, [addToast, fetchPosts, t])

  const shiftMonth = (delta: number) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }
  const goToday = () => {
    const now = new Date()
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(now)
  }

  return (
    <>
      <Topbar
        title={t('title')}
        description={t('pageDescription')}
        actionButton={{ label: t('newPost'), onClick: () => openNewComposer() }}
      />
      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <ProjectBar
              projects={projects}
              activeProjectId={activeProjectId}
              onSelect={setActiveProjectId}
              onCreate={createProject}
            />
            <FormatTabs value={format} onChange={setFormat} />
          </div>

          <SocialCalendar
            monthCursor={monthCursor}
            selectedDate={selectedDate}
            posts={posts}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            onToday={goToday}
            onSelectDate={setSelectedDate}
            onAddContent={openNewComposer}
            onEditPost={openEditComposer}
            onCancelPost={cancelPost}
            onRetryPost={retryPost}
          />
        </div>
      </div>

      <PostComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        initialFormat={format}
        initialDate={selectedDate}
        editPost={editPost}
        targets={targets}
        metaConnected={metaConnected}
        onSubmit={submitComposer as any}
        onUploadError={() => addToast(t('toasts.uploadError'), 'error')}
      />

      {showGate && <AccessRequiredModal type="subscription" featureKey="social_media_management" />}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
