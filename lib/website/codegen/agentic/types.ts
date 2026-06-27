/**
 * lib/website/codegen/agentic/types.ts
 *
 * Type definitions for the agentic website build pipeline (Faz 2 Stage B).
 */

export interface RunAgenticBuildInput {
  /** Unique job identifier (e.g. "abc123-<uuid8>") */
  jobId: string
  /** Website record ID in the database */
  websiteId: string
  /** Authenticated user ID */
  userId: string
  /** Website scope / business identifier */
  scope: string
  /** Structured site brief (pages, brand, sections) */
  brief: object
  /** Serialised brand context JSON (from brandProfileStore) */
  brandContextJson: string
  /** Callback base URL, e.g. "https://dijimagic.com" */
  callbackBase: string
  /** HMAC secret shared with sandbox for callback auth */
  hmacSecret: string
}

export interface RunAgenticBuildResult {
  /** Daytona sandbox ID (kept alive — worker is running detached) */
  sandboxId: string
  /** Session ID used for the detached worker process */
  sessionId: string
  /** Command ID of the detached worker process (for status polling) */
  cmdId: string
}
