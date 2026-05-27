import { buildGenerationPrompt } from '@/lib/yoai/prompts'
import type { ContentCategory } from '@/lib/yoai/types'
import { claudeStream, isClaudeReady } from '@/lib/anthropic/text'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { category, params } = (await req.json()) as {
      category: Exclude<ContentCategory, 'off_topic'>
      params: Record<string, string>
    }

    if (!category || !params) {
      return Response.json({ error: 'Kategori ve parametreler gerekli' }, { status: 400 })
    }

    if (!isClaudeReady()) {
      return Response.json({ error: 'AI servisi yapılandırılmamış' }, { status: 500 })
    }

    const systemPrompt = buildGenerationPrompt(category, params)

    // Claude akışı — istemci kontratı: data: {content} ... data: [DONE]
    const stream = claudeStream({
      system: systemPrompt,
      user: 'İçeriği oluştur.',
      maxTokens: 4000,
      temperature: 0.6,
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[YoAi Chat] Unexpected error:', err)
    return Response.json({ error: 'Beklenmeyen bir hata oluştu' }, { status: 500 })
  }
}
