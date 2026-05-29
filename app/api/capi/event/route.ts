import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/billing/user'
import { resolveMetaContext } from '@/lib/meta/context'
import { META_GRAPH_VERSION } from '@/lib/metaConfig'
import { getSetup, logCapiEvent } from '@/lib/marketing-setup/setupStore'
import { sendCapiEvent, generateEventId } from '@/lib/marketing-setup/metaCapiClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface CapiBody {
  eventName?: string
  eventId?: string
  eventSourceUrl?: string
  userData?: Record<string, string | undefined>
  customData?: Record<string, unknown>
  testEventCode?: string
}

/**
 * POST /api/capi/event — production server-side Conversions API receiver.
 *
 * Resolves the caller's setup + Meta context (token + pixel + graph version),
 * builds user_data from the body, reads client ip / user-agent from request
 * headers and fbc / fbp from cookies, sends one event to Meta's CAPI, logs it,
 * and returns the result. Real Graph call only — no simulated success.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  let body: CapiBody
  try {
    body = (await request.json()) as CapiBody
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const eventName = body.eventName?.trim()
  if (!eventName) {
    return NextResponse.json({ ok: false, error: 'missing_event_name' }, { status: 400 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'meta_not_connected' }, { status: 400 })
  }

  const setup = await getSetup(user.id)

  // Resolve pixel: prefer the configured setup pixel, else first account pixel.
  let pixelId = setup?.meta_pixel_id ?? null
  if (!pixelId) {
    const pixelRes = await ctx.client.get<{ data?: { id: string }[] }>(
      `/${ctx.accountId}/adspixels`,
      { fields: 'id', limit: '1' },
    )
    pixelId = pixelRes.ok ? pixelRes.data?.data?.[0]?.id ?? null : null
  }
  if (!pixelId) {
    return NextResponse.json({ ok: false, error: 'no_pixel' }, { status: 400 })
  }

  // Transport fields.
  const headers = request.headers
  const clientIpAddress =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    undefined
  const clientUserAgent = headers.get('user-agent') || undefined

  const cookieStore = cookies()
  const fbc = cookieStore.get('_fbc')?.value || undefined
  const fbp = cookieStore.get('_fbp')?.value || undefined

  // event_id for dedup: provided, else `<eventName>.<epochMillis>.<uuid>`.
  const eventId = body.eventId?.trim() || generateEventId(eventName)

  try {
    const capi = await sendCapiEvent({
      accessToken: ctx.userAccessToken,
      pixelId,
      graphVersion: META_GRAPH_VERSION,
      eventName,
      eventId,
      eventSourceUrl: body.eventSourceUrl,
      actionSource: 'website',
      userData: body.userData,
      customData: body.customData,
      clientIpAddress,
      clientUserAgent,
      fbc,
      fbp,
      testEventCode: body.testEventCode,
    })

    const matchQuality = capi.eventsReceived
    await logCapiEvent(setup?.id ?? null, eventName, eventId, matchQuality)

    return NextResponse.json({
      ok: true,
      eventsReceived: capi.eventsReceived,
      fbtraceId: capi.fbtraceId,
      matchQuality,
    })
  } catch (e) {
    const error = e instanceof Error ? e.message : 'capi_failed'
    return NextResponse.json({ ok: false, error }, { status: 502 })
  }
}
