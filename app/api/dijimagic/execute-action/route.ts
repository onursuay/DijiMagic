import { NextResponse } from 'next/server'
import { executeAction } from '@/lib/dijimagic/actionExecutor'
import type { ExecutableAction } from '@/lib/dijimagic/actionTypes'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   POST /api/dijimagic/execute-action
   Executes a single action on Meta or Google Ads.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const action = body.action as ExecutableAction

    if (!action?.actionType || !action?.platform || !action?.entityType || !action?.entityId) {
      return NextResponse.json(
        { ok: false, error: 'invalid_payload', message: 'actionType, platform, entityType ve entityId gereklidir.' },
        { status: 400 },
      )
    }

    const result = await executeAction(action)

    return NextResponse.json(
      { ok: result.ok, data: result },
      { status: result.ok ? 200 : 422 },
    )
  } catch (error) {
    console.error('[Execute Action] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
