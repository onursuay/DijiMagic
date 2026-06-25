/* ──────────────────────────────────────────────────────────
   Anthropic SDK Client (singleton)
   Faz 2: DijiAlgoritma AI Engine için resmî SDK kullanımı.
   ────────────────────────────────────────────────────────── */

import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY tanımlı değil — AI engine devre dışı.')
  }
  _client = new Anthropic({ apiKey })
  return _client
}

export function isAnthropicReady(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/**
 * AI Engine için varsayılan model. Sonnet 4.6: hızlı agentic loop +
 * adaptive thinking + 64K output. Override için ANTHROPIC_MODEL_AI_ENGINE.
 */
export function getAiEngineModel(): string {
  return process.env.ANTHROPIC_MODEL_AI_ENGINE || 'claude-sonnet-4-6'
}

/**
 * AI fallback teşhisi (Optimizasyon Sihirli Tarama). Senkron Claude çağrısı
 * başarısız olunca sebebi kısa bir koda indirger — log + response.aiFallbackReason
 * için. Strateji'deki ([lib/strategy/ai-generator.ts]) kalıbın paylaşılan hâli.
 * UI'da ham gösterilmez; yalnız teşhis amaçlıdır (Network/log).
 */
export function describeAiFallback(err: unknown): string {
  // JSON.parse hatası — model JSON yerine metin döndü ya da çıktı kesildi
  if (err instanceof SyntaxError) return 'parse_error'
  const e = err as { status?: number; name?: string; message?: string; error?: { error?: { type?: string } } }
  const name = e?.name || ''
  const msg = e?.message || ''
  // Timeout (SDK: APIConnectionTimeoutError / APITimeoutError)
  if (/timeout/i.test(name) || /timed? ?out/i.test(msg)) return 'timeout'
  // HTTP durum kodu (400 = model/parametre uyumsuz, 429 = limit, 529 = aşırı yük…)
  const apiStatus = e?.status
  if (apiStatus) {
    const apiType = e?.error?.error?.type
    return `api_${apiStatus}${apiType ? ` ${apiType}` : ''}`
  }
  // Bağlantı / ağ hatası
  if (/connection/i.test(name) || /ECONNRESET|ENOTFOUND|fetch failed/i.test(msg)) return 'connection'
  return msg ? msg.slice(0, 140) : 'unknown_error'
}
