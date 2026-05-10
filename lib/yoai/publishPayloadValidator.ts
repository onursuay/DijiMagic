/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Publish Payload Validator (Faz 6)

   Meta API çağrısından ÖNCE proposal alanlarını doğrular.
   LLM çağrısı yapılmaz; sahte veri üretilmez.
   ────────────────────────────────────────────────────────── */

import type { FullAdProposal } from './adCreator'

export interface PayloadValidationResult {
  ok: boolean
  missingFields: string[]
  message?: string
}

interface FieldSpec {
  key: keyof FullAdProposal | string
  label: string
  /** Zorunlu alan sadece destination bu değerlerdeyse (undefined = her zaman zorunlu). */
  requiredForDestinations?: string[]
  check: (proposal: FullAdProposal) => boolean
}

const FIELD_SPECS: FieldSpec[] = [
  {
    key: 'platform',
    label: 'Platform',
    check: (p) => typeof p.platform === 'string' && p.platform.length > 0,
  },
  {
    key: 'campaignName',
    label: 'Kampanya adı',
    check: (p) => typeof p.campaignName === 'string' && p.campaignName.trim().length > 0,
  },
  {
    key: 'campaignObjective',
    label: 'Kampanya hedefi',
    check: (p) =>
      typeof p.campaignObjective === 'string' && p.campaignObjective.trim().length > 0,
  },
  {
    key: 'headline',
    label: 'Başlık (headline)',
    check: (p) => typeof p.headline === 'string' && p.headline.trim().length > 0,
  },
  {
    key: 'dailyBudget',
    label: 'Günlük bütçe',
    check: (p) => typeof p.dailyBudget === 'number' && p.dailyBudget > 0,
  },
  {
    key: 'finalUrl',
    label: 'Hedef URL (finalUrl)',
    // Lead objective doesn't need a website URL
    requiredForDestinations: ['WEBSITE', 'APP', 'MESSENGER'],
    check: (p) => {
      const dest = (p.destinationType || '').toUpperCase()
      if (!dest || dest === 'LEAD_GEN' || dest === 'ON_AD' || dest === 'INSTANT_FORM') {
        return true
      }
      return typeof p.finalUrl === 'string' && p.finalUrl.trim().startsWith('http')
    },
  },
  {
    key: 'primaryText',
    label: 'Reklam metni (primaryText)',
    check: (p) => typeof p.primaryText === 'string' && p.primaryText.trim().length > 0,
  },
]

/**
 * Proposal'ın Meta yayın için zorunlu alanlarını kontrol eder.
 * Hatalı/eksik alan varsa missingFields dolu döner.
 */
export function validatePublishPayload(proposal: FullAdProposal): PayloadValidationResult {
  const missing: string[] = []

  for (const spec of FIELD_SPECS) {
    if (!spec.check(proposal)) {
      missing.push(spec.label)
    }
  }

  if (missing.length === 0) {
    return { ok: true, missingFields: [] }
  }

  return {
    ok: false,
    missingFields: missing,
    message: `Yayın için gerekli alanlar eksik: ${missing.join(', ')}.`,
  }
}
