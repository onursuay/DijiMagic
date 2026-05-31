import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { deleteAccount, setDefaultAccount } from '@/lib/email/sendingAccountStore'

export const dynamic = 'force-dynamic'

/** PATCH — varsayılan gönderim hesabı yap. */
export async function PATCH(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const { id } = await params
  const ok = await setDefaultAccount(id, access.user.id)
  return NextResponse.json({ ok })
}

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const { id } = await params
  const ok = await deleteAccount(id, access.user.id)
  return NextResponse.json({ ok })
}
