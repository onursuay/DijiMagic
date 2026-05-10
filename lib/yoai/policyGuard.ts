/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Policy Guard (Faz 6)

   Deterministic içerik politikası kontrolü.
   Yasaklı kelimeler, garanti ifadeleri, hassas kategori
   tetikleyicileri — yalnızca string eşleştirme, LLM yok.
   Sahte veri üretilmez; her kontrol açıklanabilir.
   ────────────────────────────────────────────────────────── */

import type { FullAdProposal } from './adCreator'

export interface PolicyViolation {
  field: string
  pattern: string
  reason: string
}

export interface PolicyCheckResult {
  ok: boolean
  violations: PolicyViolation[]
  riskLevel: 'none' | 'low' | 'high'
  message?: string
}

/* ── Yasaklı kalıplar ── */

interface BannedPattern {
  regex: RegExp
  reason: string
  riskLevel: 'low' | 'high'
}

const BANNED_PATTERNS: BannedPattern[] = [
  // Finansal garanti iddiaları
  {
    regex: /garantili\s*(kazanç|gelir|kâr|yatırım|para)/i,
    reason: 'Garantili finansal kazanç iddiası — Meta politikasına aykırı.',
    riskLevel: 'high',
  },
  {
    regex: /kesin(lik)?\s*(para|kazanç|gelir|kâr)/i,
    reason: 'Kesinlik içeren finansal iddia — reklam politikasına aykırı.',
    riskLevel: 'high',
  },
  {
    regex: /risk(siz|sız)\s*(yatırım|kazanç|para)/i,
    reason: 'Risksiz yatırım iddiası — Meta politikasına aykırı.',
    riskLevel: 'high',
  },
  {
    regex: /hızlı\s*(zen[gn]inleş|para\s*kazan|kazanç)/i,
    reason: 'Hızlı zenginleşme / kolay kazanç vaadi — politika ihlali.',
    riskLevel: 'high',
  },
  {
    regex: /100\s*%\s*(garantili|garanti|kesin|emin)/i,
    reason: '%100 garanti ifadesi — aldatıcı reklam yasağı.',
    riskLevel: 'high',
  },
  // Bahis / Kumar
  {
    regex: /\b(kumar|bahis|slot\s*oyun|casino|poker\s*site)/i,
    reason: 'Kumar/bahis içeriği — lisanssız ise yasak kategori.',
    riskLevel: 'high',
  },
  // İlaç / Sağlık garantisi
  {
    regex: /(kesin(likle)?\s*(tedavi|iyileş|şif|kür)|garantili\s*(şifa|tedavi|iyileşme))/i,
    reason: 'Kesin tedavi/şifa garantisi — sağlık reklam politikasına aykırı.',
    riskLevel: 'high',
  },
  // Clickbait / Tıklama tuzağı
  {
    regex: /inan(amaz|mayacaksın|mayacaksınız)\s*ama/i,
    reason: 'Clickbait ifadesi — kaliteli reklam politikasına aykırı.',
    riskLevel: 'low',
  },
  {
    regex: /bu\s*(sırrı|triki)\s*(kimse\s*)?(paylaşmıyor|bilmiyor)/i,
    reason: 'Gizli sır/trik taktik — yanıltıcı içerik.',
    riskLevel: 'low',
  },
  // İngilizce garantiler
  {
    regex: /guaranteed\s*(income|profit|earnings|returns?|money)/i,
    reason: 'Guaranteed financial return claim — violates Meta policy.',
    riskLevel: 'high',
  },
  {
    regex: /get\s*rich\s*quick/i,
    reason: 'Get-rich-quick scheme language — policy violation.',
    riskLevel: 'high',
  },
  {
    regex: /risk[\s-]free\s*(investment|money|profit)/i,
    reason: 'Risk-free investment claim — violates advertising policy.',
    riskLevel: 'high',
  },
]

/* ── Text alanlarını topla ── */

function collectTextFields(proposal: FullAdProposal): Array<{ field: string; text: string }> {
  const fields: Array<{ field: string; text: string }> = []

  const add = (field: string, value: string | undefined | null) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      fields.push({ field, text: value })
    }
  }

  add('campaignName', proposal.campaignName)
  add('headline', proposal.headline)
  add('primaryText', proposal.primaryText)
  add('description', proposal.description)

  if (Array.isArray(proposal.headlines)) {
    proposal.headlines.forEach((h, i) => add(`headlines[${i}]`, h))
  }
  if (Array.isArray(proposal.descriptions)) {
    proposal.descriptions.forEach((d, i) => add(`descriptions[${i}]`, d))
  }

  return fields
}

/**
 * Proposal içerik alanlarını deterministic kurallara göre kontrol eder.
 * LLM çağrısı yapılmaz.
 *
 * ok:false → route yayını bloklar ve POLICY_VIOLATION kodu döner.
 */
export function checkPolicyViolations(proposal: FullAdProposal): PolicyCheckResult {
  const violations: PolicyViolation[] = []
  const textFields = collectTextFields(proposal)

  for (const { field, text } of textFields) {
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.regex.test(text)) {
        violations.push({
          field,
          pattern: pattern.regex.source,
          reason: pattern.reason,
        })
      }
    }
  }

  if (violations.length === 0) {
    return { ok: true, violations: [], riskLevel: 'none' }
  }

  const hasHigh = violations.some((v) => {
    const bp = BANNED_PATTERNS.find((p) => p.regex.source === v.pattern)
    return bp?.riskLevel === 'high'
  })

  const riskLevel = hasHigh ? 'high' : 'low'

  return {
    ok: riskLevel !== 'high',
    violations,
    riskLevel,
    message:
      riskLevel === 'high'
        ? `Reklam politikası ihlali tespit edildi (${violations.length} uyarı). Yayın bloklandı.`
        : `İçerik politikası uyarısı (${violations.length} düşük riskli ifade). Yayına devam edildi.`,
  }
}
