/* ──────────────────────────────────────────────────────────
   Strateji Motoru — Claude (Anthropic) tek-atış JSON tamamlaması

   Strateji blueprint üretimi ve optimizasyon önerileri için OpenAI
   yerine projenin standart Claude motorunu kullanır (DijiAlgoritma ile
   aynı SDK + model). Sistem promptu prompt-cache'lenir (ephemeral) —
   aynı sistem bloğu tekrar çağrıldığında cache-read.

   Hata/timeout durumunda THROW eder; çağıran taraf template/fallback'e
   düşer (deterministik davranış korunur).
   ────────────────────────────────────────────────────────── */

import { getAnthropicClient, getAiEngineModel, isAnthropicReady } from '@/lib/anthropic/client'

export { isAnthropicReady }

/** Markdown fence + ön/son metni temizleyip ilk geçerli JSON'u ayıklar. */
export function extractJsonText(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) return fence[1].trim()
  return text.trim()
}

/**
 * Strateji için tek-atış Claude çağrısı; ham metin döner.
 * @throws ANTHROPIC_API_KEY yoksa veya API hatası/timeout olursa.
 */
export async function strategyClaudeText(args: {
  system: string
  user: string
  maxTokens?: number
  timeoutMs?: number
  temperature?: number
}): Promise<string> {
  const client = getAnthropicClient()
  const res = await client.messages.create(
    {
      model: getAiEngineModel(),
      max_tokens: args.maxTokens ?? 4000,
      temperature: args.temperature ?? 0.4,
      system: [{ type: 'text', text: args.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: args.user }],
    },
    { timeout: args.timeoutMs ?? 30000 },
  )
  let text = ''
  for (const block of res.content) {
    if (block.type === 'text') text += block.text
  }
  return text
}
