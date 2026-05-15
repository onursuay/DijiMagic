'use client'

import AccessRequiredModal from './AccessRequiredModal'

export interface CreditRequiredModalProps {
  /** Hangi alanın engellendiği — başlığa/açıklamaya katılır */
  featureName?: string
  /** Modal başlığı; verilmezse default Türkçe metin */
  title?: string
  /** Açıklama metni; verilmezse default */
  description?: string
  /** Eski API: "Premium" / "Starter" gibi rozet — yeni modal'da `badgeLabel` ile aynı işlevi görür */
  requiredPlanLabel?: string
  /** Primary CTA buton metni */
  ctaLabel?: string
  /** Primary CTA hedefi — default `/abonelik` */
  billingHref?: string
  /** Telemetri/log için kısa sebep (UI'da gösterilmez) */
  reason?: string
}

/**
 * Geriye dönük uyumluluk için korunan eski API.
 *
 * Yeni kod doğrudan `AccessRequiredModal type="credit"` kullanmalıdır.
 * Bu wrapper mevcut import sitelerinin bozulmamasını sağlar; davranış,
 * görünüm ve CTA hedefi `AccessRequiredModal` ile aynıdır.
 *
 * Kapsamlı standart için bkz: `components/billing/AccessRequiredModal.tsx`
 * ve `lib/billing/featureAccessMap.ts`.
 */
export default function CreditRequiredModal({
  featureName,
  title,
  description,
  requiredPlanLabel,
  ctaLabel,
  billingHref,
  reason,
}: CreditRequiredModalProps) {
  return (
    <AccessRequiredModal
      type="credit"
      featureName={featureName}
      title={title}
      description={description}
      badgeLabel={requiredPlanLabel}
      ctaLabel={ctaLabel}
      ctaHref={billingHref}
      reason={reason}
    />
  )
}
