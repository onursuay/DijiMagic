import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/billing/user'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!supabase) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: string
    newPassword?: string
  }
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('signups')
    .select('password_hash')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data?.password_hash) {
    return NextResponse.json({ error: 'no_password_set' }, { status: 400 })
  }

  const valid = await bcrypt.compare(currentPassword, data.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'wrong_password' }, { status: 400 })
  }

  const newHash = await bcrypt.hash(newPassword, 10)
  const { error: updErr } = await supabase
    .from('signups')
    .update({ password_hash: newHash, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (updErr) return NextResponse.json({ error: 'update_failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
