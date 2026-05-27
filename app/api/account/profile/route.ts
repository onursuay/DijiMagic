import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/billing/user'
import { getIsCurrentUserSuperAdmin } from '@/lib/admin/superAdmin'

export const dynamic = 'force-dynamic'

/** signups.name tek alan; UI ad/soyad için ilk kelime = ad, kalanı = soyad. */
function splitName(full: string | null): { firstName: string; lastName: string } {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/** Kullanıcı id'sinden stabil (her oturumda aynı) referans kodu üret. */
function referralCodeFromId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const isOwner = await getIsCurrentUserSuperAdmin()
  const { firstName, lastName } = splitName(user.name)

  return NextResponse.json({
    id: user.id,
    firstName,
    lastName,
    email: user.email,
    referralCode: referralCodeFromId(user.id),
    isOwner,
  })
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!supabase) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const body = (await req.json().catch(() => ({}))) as { firstName?: string; lastName?: string }
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
  const fullName = `${firstName} ${lastName}`.trim()

  if (!fullName) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  const { error } = await supabase
    .from('signups')
    .update({ name: fullName, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 })

  const res = NextResponse.json({ ok: true, firstName, lastName, name: fullName })
  // Sidebar/dropdown display cookie'sini senkron tut (login/verify ile aynı format).
  res.cookies.set('user_name', fullName, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
