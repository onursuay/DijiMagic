/**
 * Kullanıcı fatura/vergi profili — sunucu tarafı kalıcılık (H9).
 * Eskiden yalnız localStorage'daydı; iyzico'ya placeholder buyer/billingAddress
 * gidiyordu. Bu store dolu ise checkout gerçek bilgiyle yapılır.
 *
 * GÜVENLİK/ADDITIVE: Tablo henüz yoksa (migration uygulanmadıysa) tüm okuma/yazma
 * sessizce null/false döner → checkout eski (çalışan) placeholder davranışına düşer,
 * ödeme akışı ASLA bozulmaz. Yalnız billing API route'larından import edilir.
 */
import 'server-only'
import { supabase } from '@/lib/supabase/client'
import type { InvoiceInfo } from '@/lib/subscription/types'

export interface BillingProfile extends InvoiceInfo {
  /** Bireysel TC kimlik no (opsiyonel — form henüz toplamıyorsa boş kalır). */
  identityNumber?: string
}

function rowToProfile(row: Record<string, unknown>): BillingProfile {
  return {
    type: row.type === 'corporate' ? 'corporate' : 'individual',
    fullName: (row.full_name as string) ?? '',
    lastName: (row.last_name as string) ?? '',
    phone: (row.phone as string) ?? '',
    country: (row.country as string) ?? 'Türkiye',
    city: (row.city as string) ?? '',
    district: (row.district as string) ?? '',
    postalCode: (row.postal_code as string) ?? '',
    address: (row.address as string) ?? '',
    companyName: (row.company_name as string) ?? undefined,
    taxOffice: (row.tax_office as string) ?? undefined,
    taxNumber: (row.tax_number as string) ?? undefined,
    identityNumber: (row.identity_number as string) ?? undefined,
  }
}

export async function getBillingProfile(userId: string): Promise<BillingProfile | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('user_billing_profile')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    return rowToProfile(data as Record<string, unknown>)
  } catch {
    // Tablo yok (migration uygulanmadı) → null; checkout placeholder fallback'e düşer.
    return null
  }
}

export async function saveBillingProfile(userId: string, info: BillingProfile): Promise<boolean> {
  if (!supabase) return false
  try {
    const { error } = await supabase
      .from('user_billing_profile')
      .upsert(
        {
          user_id: userId,
          type: info.type === 'corporate' ? 'corporate' : 'individual',
          full_name: info.fullName || null,
          last_name: info.lastName || null,
          phone: info.phone || null,
          country: info.country || 'Türkiye',
          city: info.city || null,
          district: info.district || null,
          postal_code: info.postalCode || null,
          address: info.address || null,
          company_name: info.companyName || null,
          tax_office: info.taxOffice || null,
          tax_number: info.taxNumber || null,
          identity_number: info.identityNumber || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    return !error
  } catch {
    return false
  }
}
