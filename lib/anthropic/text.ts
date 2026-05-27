/* ──────────────────────────────────────────────────────────
   Paylaşılan Claude (Anthropic) metin yardımcısı.

   Projedeki TEK AI sağlayıcısı Claude'dur. Bu modül, hem edge hem
   node runtime'da çalışacak şekilde RAW fetch ile Anthropic Messages
   API'sine gider (SDK'nın edge'de singleton sorunlarını önler).

   - claudeText(): tek-atış metin tamamlaması (string | null döner)
   - claudeStream(): SSE akışı → istemci kontratı `data: {content}` + `data: [DONE]`

   ANTHROPIC_API_KEY yoksa claudeText null döner, claudeStream boş akış
   kapatır — çağıran taraf deterministik fallback'e düşebilir.
   ────────────────────────────────────────────────────────── */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/** Projenin standart Claude modeli. Override: ANTHROPIC_MODEL_AI_ENGINE. */
export function getClaudeModel(): string {
  return process.env.ANTHROPIC_MODEL_AI_ENGINE || 'claude-sonnet-4-6'
}

export function isClaudeReady(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export interface ClaudeTextArgs {
  /** Sistem promptu (opsiyonel). */
  system?: string
  /** Kullanıcı mesajı. */
  user: string
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  /** Modeli override etmek için (varsayılan getClaudeModel()). */
  model?: string
}

function extractText(data: unknown): string {
  const blocks = (data as { content?: { type?: string; text?: string }[] })?.content
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
}

/**
 * Tek-atış Claude çağrısı. Hata/timeout/anahtar yokluğunda null döner
 * (THROW etmez) — çağıranların graceful fallback davranışını korur.
 */
export async function claudeText(args: ClaudeTextArgs): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: args.model || getClaudeModel(),
        max_tokens: args.maxTokens ?? 4000,
        temperature: args.temperature ?? 0.5,
        ...(args.system ? { system: args.system } : {}),
        messages: [{ role: 'user', content: args.user }],
      }),
      signal: AbortSignal.timeout(args.timeoutMs ?? 60000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[claude] error', res.status, errText.slice(0, 200))
      return null
    }

    const data = await res.json()
    const text = extractText(data)
    return text || null
  } catch (e) {
    console.error('[claude] exception', e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Metinden ilk JSON objesini toleranslı ayıklar (kod bloğu/önek metne dayanıklı). */
export function extractJsonObject(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  return start !== -1 && end !== -1 && end > start ? candidate.slice(start, end + 1) : candidate
}

/**
 * JSON çıktısı bekleyen tek-atış Claude çağrısı. Modelden gelen metni
 * toleranslı şekilde ayıklayıp parse eder. Hata/parse başarısızsa null döner.
 */
export async function claudeJson<T = Record<string, unknown>>(
  args: ClaudeTextArgs,
): Promise<T | null> {
  const text = await claudeText(args)
  if (!text) return null
  try {
    return JSON.parse(extractJsonObject(text)) as T
  } catch {
    return null
  }
}

/**
 * Akışlı Claude çağrısı. İstemcinin beklediği kontratı korur:
 *   data: {"content":"..."}   (her metin parçası)
 *   data: [DONE]              (bitişte)
 * Anahtar yoksa veya hata olursa akış sessizce kapanır.
 */
export function claudeStream(args: ClaudeTextArgs): ReadableStream<Uint8Array> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!apiKey) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
        return
      }

      try {
        const res = await fetch(ANTHROPIC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: args.model || getClaudeModel(),
            max_tokens: args.maxTokens ?? 4000,
            temperature: args.temperature ?? 0.5,
            stream: true,
            ...(args.system ? { system: args.system } : {}),
            messages: [{ role: 'user', content: args.user }],
          }),
        })

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => '')
          console.error('[claude:stream] error', res.status, errText.slice(0, 200))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const reader = res.body.getReader()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const payload = trimmed.slice(5).trim()
            if (!payload || payload === '[DONE]') continue

            try {
              const evt = JSON.parse(payload)
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                const content = evt.delta.text
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                }
              }
            } catch {
              // malformed chunk — atla
            }
          }
        }
      } catch (e) {
        console.error('[claude:stream] exception', e instanceof Error ? e.message : String(e))
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })
}
