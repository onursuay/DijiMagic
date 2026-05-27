import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/billing/user'

export const dynamic = 'force-dynamic'

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  starter: 'Starter',
  premium: 'Premium',
  enterprise: 'Enterprise',
}

const PACKAGE_LABELS: Record<string, string> = {
  'pkg-100': '100 Kredi',
  'pkg-500': '500 Kredi',
  'pkg-1000': '1.000 Kredi',
}

interface TxRow {
  id: string
  created_at: string
  amount: number | string
  currency: string | null
  item_type: string | null
  plan_id: string | null
  package_id: string | null
  billing_cycle: string | null
  status: string | null
}

/** item_type + plan/paket + döngüden sade Türkçe açıklama üret (ham enum gösterme). */
function buildDescription(row: TxRow): string {
  if (row.item_type === 'subscription') {
    const plan = (row.plan_id && PLAN_LABELS[row.plan_id]) || 'Abonelik'
    const cycle =
      row.billing_cycle === 'yearly' ? 'Yıllık' : row.billing_cycle === 'monthly' ? 'Aylık' : ''
    return cycle ? `${plan} Aboneliği (${cycle})` : `${plan} Aboneliği`
  }
  if (row.item_type === 'credit_pack') {
    return (row.package_id && PACKAGE_LABELS[row.package_id]) ? `${PACKAGE_LABELS[row.package_id]} Paketi` : 'Kredi Paketi'
  }
  return 'Ödeme'
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!supabase) return NextResponse.json({ invoices: [] })

  const { data, error } = await supabase
    .from('payment_transactions')
    .select('id, created_at, amount, currency, item_type, plan_id, package_id, billing_cycle, status')
    .eq('user_id', user.id)
    .in('status', ['succeeded', 'processed', 'pending'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ invoices: [] })

  const invoices = (data ?? []).map((r) => {
    const row = r as TxRow
    return {
      id: row.id,
      date: row.created_at,
      amount: Number(row.amount) || 0,
      currency: row.currency || 'TRY',
      description: buildDescription(row),
      status: row.status === 'pending' ? ('pending' as const) : ('paid' as const),
    }
  })

  return NextResponse.json({ invoices })
}
