import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { randomUUID } from 'node:crypto'

function requireClient() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return supabase
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timeout'

export interface WebsiteGenJob {
  id: string
  websiteId: string
  userId: string
  status: JobStatus
  stage: string
  progress: number
  stepLog: string[]
  brief: string | null
  locales: string[]
  siteType: string
  generatedHtml: string | null
  designVars: Record<string, string> | null
  errorReason: string | null
  inngestRunId: string | null
  /** Daytona sandbox ID — set when dispatch-sandbox step fires (T4) */
  sandboxId?: string | null
  /** Worker session ID inside the sandbox (T4) */
  sessionId?: string | null
  /** Command ID of the detached worker process (T4) */
  cmdId?: string | null
}

function rowToJob(r: Record<string, unknown>): WebsiteGenJob {
  return {
    id: r.id as string,
    websiteId: r.website_id as string,
    userId: r.user_id as string,
    status: r.status as JobStatus,
    stage: r.stage as string,
    progress: r.progress as number,
    stepLog: (r.step_log as string[]) ?? [],
    brief: (r.brief as string | null) ?? null,
    locales: (r.locales as string[]) ?? [],
    siteType: r.site_type as string,
    generatedHtml: (r.generated_html as string | null) ?? null,
    designVars: (r.design_vars as Record<string, string> | null) ?? null,
    errorReason: (r.error_reason as string | null) ?? null,
    inngestRunId: (r.inngest_run_id as string | null) ?? null,
    sandboxId: (r.sandbox_id as string | null) ?? null,
    sessionId: (r.session_id as string | null) ?? null,
    cmdId: (r.cmd_id as string | null) ?? null,
  }
}

export async function createWebsiteGenJob(opts: {
  websiteId: string
  userId: string
  brief: string
  locales: string[]
  siteType: string
}): Promise<string> {
  const db = requireClient()
  const id = randomUUID()
  const { error } = await db.from('website_gen_jobs').insert({
    id,
    website_id: opts.websiteId,
    user_id: opts.userId,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    brief: opts.brief,
    locales: opts.locales,
    site_type: opts.siteType,
  })
  if (error) throw new Error(`createWebsiteGenJob: ${error.message}`)
  return id
}

export async function getWebsiteGenJob(jobId: string): Promise<WebsiteGenJob | null> {
  const db = requireClient()
  const { data, error } = await db
    .from('website_gen_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw new Error(`getWebsiteGenJob: ${error.message}`)
  return data ? rowToJob(data as Record<string, unknown>) : null
}

export async function updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
  const db = requireClient()
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'running') patch.started_at = new Date().toISOString()
  if (status === 'completed' || status === 'failed' || status === 'timeout') {
    patch.completed_at = new Date().toISOString()
  }
  const { error } = await db.from('website_gen_jobs').update(patch).eq('id', jobId)
  if (error) throw new Error(`updateJobStatus: ${error.message}`)
}

export async function appendJobLog(
  jobId: string,
  stage: string,
  progress: number,
  stepMsg: string,
): Promise<void> {
  const db = requireClient()
  // step_log TEXT[] append — read-modify-write (son 50 satır).
  const cur = await getWebsiteGenJob(jobId)
  const nextLog = [...(cur?.stepLog ?? []), stepMsg].slice(-50)
  const { error } = await db
    .from('website_gen_jobs')
    .update({ stage, progress, step_log: nextLog, updated_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) throw new Error(`appendJobLog: ${error.message}`)
}

export async function markJobComplete(
  jobId: string,
  html: string,
  designVars: Record<string, string>,
): Promise<void> {
  const db = requireClient()
  const { error } = await db.from('website_gen_jobs').update({
    status: 'completed',
    stage: 'completed',
    progress: 100,
    generated_html: html,
    design_vars: designVars,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', jobId)
  if (error) throw new Error(`markJobComplete: ${error.message}`)
}

export async function markJobFailed(jobId: string, errorReason: string): Promise<void> {
  const db = requireClient()
  const { error } = await db.from('website_gen_jobs').update({
    status: 'failed',
    error_reason: errorReason,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', jobId)
  if (error) throw new Error(`markJobFailed: ${error.message}`)
}

export async function getLatestJobForWebsite(websiteId: string): Promise<WebsiteGenJob | null> {
  const db = requireClient()
  const { data, error } = await db
    .from('website_gen_jobs')
    .select('*')
    .eq('website_id', websiteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`getLatestJobForWebsite: ${error.message}`)
  return data ? rowToJob(data as Record<string, unknown>) : null
}

/**
 * Persist the Daytona sandbox reference fields after dispatch-sandbox fires.
 * Called immediately after runAgenticBuild() returns — before awaiting the worker.
 */
export async function persistSandboxRef(
  jobId: string,
  sandboxId: string,
  sessionId: string,
  cmdId: string,
): Promise<void> {
  const db = requireClient()
  const { error } = await db
    .from('website_gen_jobs')
    .update({ sandbox_id: sandboxId, session_id: sessionId, cmd_id: cmdId, updated_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) throw new Error(`persistSandboxRef: ${error.message}`)
}

/**
 * Read back the sandbox reference for a job (used by cleanup-sandbox step).
 * Returns null if the job has no sandbox reference (dev-fallback path).
 */
export async function getSandboxRef(
  jobId: string,
): Promise<{ sandboxId: string; sessionId: string; cmdId: string } | null> {
  const db = requireClient()
  const { data, error } = await db
    .from('website_gen_jobs')
    .select('sandbox_id, session_id, cmd_id')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw new Error(`getSandboxRef: ${error.message}`)
  if (!data || !data.sandbox_id) return null
  return {
    sandboxId: data.sandbox_id as string,
    sessionId: (data.session_id as string) ?? '',
    cmdId: (data.cmd_id as string) ?? '',
  }
}

/**
 * Find jobs that have ended in a terminal state (timeout | failed) but still
 * have a sandbox_id set — these are "orphan" sandboxes that were never deleted
 * (e.g. the callback never arrived, reconcile timed them out, but sandbox was
 * not cleaned up). The caller is responsible for calling deleteSandbox() on
 * each and then clearSandboxRef() to prevent double-deletion on future runs.
 */
export async function findOrphanSandboxes(): Promise<
  Array<{ jobId: string; sandboxId: string }>
> {
  const db = requireClient()
  const { data, error } = await db
    .from('website_gen_jobs')
    .select('id, sandbox_id')
    .in('status', ['timeout', 'failed'])
    .not('sandbox_id', 'is', null)
  if (error) throw new Error(`findOrphanSandboxes: ${error.message}`)
  return (data ?? []).map((r) => ({
    jobId: r.id as string,
    sandboxId: r.sandbox_id as string,
  }))
}

/**
 * Clear the sandbox reference fields after a sandbox has been deleted.
 * Sets sandbox_id, session_id, cmd_id to NULL so the record is not picked up
 * again by findOrphanSandboxes() on the next reconcile run.
 */
export async function clearSandboxRef(jobId: string): Promise<void> {
  const db = requireClient()
  const { error } = await db
    .from('website_gen_jobs')
    .update({
      sandbox_id: null,
      session_id: null,
      cmd_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
  if (error) throw new Error(`clearSandboxRef: ${error.message}`)
}

export async function reconcileStaleJobs(
  staleThresholdMinutes = 15,
): Promise<{ reconciled: number }> {
  const db = requireClient()
  const cutoff = new Date(Date.now() - staleThresholdMinutes * 60_000).toISOString()
  const { data, error } = await db
    .from('website_gen_jobs')
    .update({
      status: 'timeout',
      error_reason: 'reconcile:stale',
      completed_at: new Date().toISOString(),
    })
    .in('status', ['queued', 'running'])
    .lt('updated_at', cutoff)
    .select('id')
  if (error) throw new Error(`reconcileStaleJobs: ${error.message}`)
  return { reconciled: data?.length ?? 0 }
}
